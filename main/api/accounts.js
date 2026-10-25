import { supabase } from './db_connection.js';

// Helper to get and authenticate caller
async function getAuthenticatedAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Authorization header missing or invalid.');
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
        throw new Error('Invalid or expired session token.');
    }

    // Check caller role
    const { data: roleData, error: roleError } = await supabase
        .from('user-roles')
        .select('roles')
        .eq('user_id', user.id)
        .maybeSingle();

    const role = roleData?.roles;
    if (role !== 'admin' && role !== 'tabHead') {
        throw new Error('Access forbidden. Admin or TabHead role required.');
    }

    return { user, role };
}

async function logAction(userId, action, details) {
    try {
        await supabase.from('audit_log').insert({
            user_id: userId,
            actions: action,
            details: details
        });
    } catch (err) {
        console.error('Audit log error:', err.message);
    }
}

// Safely set or update user role in user-roles table without requiring a unique constraint
async function setUserRole(userId, role) {
    const { data: existingRows, error: checkError } = await supabase
        .from('user-roles')
        .select('*')
        .eq('user_id', userId);

    if (checkError) {
        console.warn('Warning checking user-roles table:', checkError.message);
    }

    if (existingRows && existingRows.length > 0) {
        const { error: updateError } = await supabase
            .from('user-roles')
            .update({ roles: role })
            .eq('user_id', userId);
        if (updateError) throw updateError;
    } else {
        const { error: insertError } = await supabase
            .from('user-roles')
            .insert({ user_id: userId, roles: role });
        if (insertError) throw insertError;
    }
}

const defaultPrivilegesByRole = {
    admin: ['accounts', 'tabulation', 'computation', 'config', 'log', 'live_feed', 'export'],
    tabHead: ['tabulation', 'config', 'live_feed', 'export'],
    committee: ['computation', 'live_feed']
};

export default async (req, res) => {
    try {
        const { user: caller, role: callerRole } = await getAuthenticatedAdmin(req);

        // GET: List all accounts
        if (req.method === 'GET') {
            const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
                page: 1,
                perPage: 1000
            });
            if (listError) throw listError;

            const { data: rolesData, error: rolesError } = await supabase
                .from('user-roles')
                .select('*');
            if (rolesError) throw rolesError;

            const roleMap = {};
            rolesData.forEach(r => { roleMap[r.user_id] = r.roles; });

            const accounts = (usersData?.users || []).map(u => {
                const role = roleMap[u.id] || 'committee';
                const meta = u.user_metadata || {};
                const privileges = Array.isArray(meta.privileges)
                    ? meta.privileges
                    : (defaultPrivilegesByRole[role] || ['computation', 'live_feed']);
                const password = meta.password_display || '••••••••';

                return {
                    id: u.id,
                    email: u.email,
                    role: role,
                    password: password,
                    privileges: privileges,
                    created_at: u.created_at,
                    last_sign_in_at: u.last_sign_in_at
                };
            });

            // Sort: admin first, then tabHead, then committee, then by email
            const roleOrder = { admin: 1, tabHead: 2, committee: 3 };
            accounts.sort((a, b) => {
                const rA = roleOrder[a.role] || 99;
                const rB = roleOrder[b.role] || 99;
                if (rA !== rB) return rA - rB;
                return (a.email || '').localeCompare(b.email || '');
            });

            return res.status(200).json({ success: true, accounts });
        }

        // POST: Mutations (create, update, delete, savePrivileges)
        if (req.method === 'POST') {
            const body = req.body || {};
            const { action } = body;

            // 1. Create Account
            if (action === 'create') {
                const { email, password, role, privileges } = body;
                if (!email || !password || !role) {
                    return res.status(400).json({ error: 'Email, password, and account type are required.' });
                }

                const userPrivileges = Array.isArray(privileges) && privileges.length > 0
                    ? privileges
                    : (defaultPrivilegesByRole[role] || ['computation', 'live_feed']);

                let userId;
                let createdAt;

                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: email.trim(),
                    password: password,
                    email_confirm: true,
                    user_metadata: {
                        password_display: password,
                        privileges: userPrivileges
                    }
                });

                if (createError) {
                    // If account was already registered in auth during a prior failed attempt, update credentials and finish setup
                    if (createError.message && createError.message.toLowerCase().includes('already')) {
                        const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
                        const existingUser = listData?.users?.find(u => (u.email || '').toLowerCase() === email.trim().toLowerCase());
                        if (existingUser) {
                            userId = existingUser.id;
                            createdAt = existingUser.created_at;
                            await supabase.auth.admin.updateUserById(userId, {
                                password: password,
                                user_metadata: {
                                    ...(existingUser.user_metadata || {}),
                                    password_display: password,
                                    privileges: userPrivileges
                                }
                            });
                        } else {
                            throw createError;
                        }
                    } else {
                        throw createError;
                    }
                } else {
                    userId = newUser.user.id;
                    createdAt = newUser.user.created_at;
                }

                try {
                    await setUserRole(userId, role);
                } catch (roleError) {
                    console.error('Role insertion failed for user:', userId, roleError);
                    throw roleError;
                }

                await logAction(caller.id, 'createAccount', `Created new ${role} account: "${email.trim()}"`);

                return res.status(200).json({
                    success: true,
                    account: {
                        id: userId,
                        email: email.trim(),
                        role,
                        password,
                        privileges: userPrivileges,
                        created_at: createdAt
                    }
                });
            }

            // 2. Update Account (Email, Password, Role)
            if (action === 'update') {
                const { userId, email, password, role } = body;
                if (!userId) {
                    return res.status(400).json({ error: 'User ID is required for update.' });
                }

                // Get current user metadata
                const { data: { user: targetUser }, error: getError } = await supabase.auth.admin.getUserById(userId);
                if (getError || !targetUser) throw new Error('Target user not found.');

                const updatePayload = {
                    user_metadata: { ...(targetUser.user_metadata || {}) }
                };

                if (email && email.trim() && email.trim() !== targetUser.email) {
                    updatePayload.email = email.trim();
                    updatePayload.email_confirm = true;
                }

                if (password && password.trim() && password.trim() !== '••••••••') {
                    updatePayload.password = password.trim();
                    updatePayload.user_metadata.password_display = password.trim();
                }

                if (role) {
                    await setUserRole(userId, role);
                }

                const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
                    userId,
                    updatePayload
                );
                if (updateError) throw updateError;

                await logAction(caller.id, 'updateAccount', `Updated account credentials/role for "${targetUser.email}"`);

                return res.status(200).json({ success: true, user: updatedUser });
            }

            // 3. Delete Account
            if (action === 'delete') {
                const { userId } = body;
                if (!userId) {
                    return res.status(400).json({ error: 'User ID is required for deletion.' });
                }

                if (userId === caller.id) {
                    return res.status(400).json({ error: 'Cannot delete your own active account.' });
                }

                // Get user info for log
                const { data: { user: targetUser } } = await supabase.auth.admin.getUserById(userId);
                const targetEmail = targetUser?.email || userId;

                // Delete from user-roles table
                await supabase.from('user-roles').delete().eq('user_id', userId);

                // Delete from Supabase Auth
                const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
                if (deleteError) throw deleteError;

                await logAction(caller.id, 'deleteAccount', `Deleted account: "${targetEmail}"`);

                return res.status(200).json({ success: true, message: `Account ${targetEmail} deleted.` });
            }

            // 4. Save Privileges
            if (action === 'savePrivileges') {
                const { userId, privileges } = body;
                if (!userId || !Array.isArray(privileges)) {
                    return res.status(400).json({ error: 'User ID and privileges array are required.' });
                }

                const { data: { user: targetUser }, error: getError } = await supabase.auth.admin.getUserById(userId);
                if (getError || !targetUser) throw new Error('Target user not found.');

                const meta = { ...(targetUser.user_metadata || {}), privileges };

                const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
                    user_metadata: meta
                });
                if (updateError) throw updateError;

                await logAction(caller.id, 'savePrivileges', `Updated access privileges for "${targetUser.email}"`);

                return res.status(200).json({ success: true, privileges });
            }

            return res.status(400).json({ error: 'Invalid action requested.' });
        }

        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in /api/accounts:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};
