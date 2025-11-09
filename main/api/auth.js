// This new file replaces api/login.js
// It handles checking a user's session token and returning their role.
import { supabase } from './db_connection.js'; 

export default async (req, res) => {
    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        // 1. GET TOKEN FROM AUTHORIZATION HEADER
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization header missing or invalid.' });
        }
        const token = authHeader.split(' ')[1];

        // 2. VALIDATE TOKEN AND GET USER
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid or expired session token.' });
        }

        // 3. GET ROLE
        const { data: roleData, error: roleError } = await supabase
            .from('user-roles') 
            .select('roles')
            .eq('user_id', user.id)
            .single();

        if (roleError || !roleData) {
            console.error('Role not found for user:', user.id, roleError);
            return res.status(500).json({ error: 'Could not find user role.' });
        }

        // Success! Send back the role.
        return res.status(200).json({ role: roleData.roles });

    } catch (error) {
        console.error('Error in /api/auth:', error);
        return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};