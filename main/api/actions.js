import { supabase } from './db_connection.js';

// Helper function to get the user from a token
async function getUser(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
}

// Helper function to write to the audit log
async function logAction(userId, action, details) { 
    try {
        await supabase.from('audit_log').insert({
            user_id: userId, 
            actions: action,
            details: details
        });
    } catch (logError) {
        console.error('Failed to write to audit log:', logError);
    }
}

// Helper function to get an event's name from its ID
async function getEventName(eventId) {
    if (!eventId) return 'unknown_event';
    try {
        const { data, error } = await supabase
            .from('events')
            .select('name')
            .eq('id', eventId)
            .single(); 
            
        if (error || !data) {
            console.error('Error fetching event name:', error);
            return `Event ID ${eventId}`; 
        }
        return `"${data.name}"`; 
    } catch (err) {
        console.error('Exception fetching event name:', err);
        return `Event ID ${eventId}`; 
    }
}

// --- NEW: Helper function to get a team's name from its ID ---
async function getTeamName(teamId) {
    if (!teamId) return 'unknown_team';
    try {
        const { data, error } = await supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single();
        if (error || !data) {
            console.error('Error fetching team name:', error);
            return `Team ID ${teamId}`;
        }
        return `"${data.name}"`;
    } catch (err) {
        console.error('Exception fetching team name:', err);
        return `Team ID ${teamId}`;
    }
}

// --- NEW: Helper to upload image and return URL ---
async function uploadLogo(file, bucketPath) {
    if (!file) return null;

    const fileName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`; // Unique filename
    const { data, error } = await supabase.storage
        .from('logos') // Make sure you have a 'logos' bucket in Supabase
        .upload(`${bucketPath}/${fileName}`, file, {
            cacheControl: '3600',
            upsert: false // Don't overwrite if file exists with same name
        });

    if (error) {
        console.error('Supabase storage upload error:', error);
        throw new Error('Failed to upload logo.');
    }

    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(`${bucketPath}/${fileName}`);

    if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('Failed to get public URL for logo.');
    }

    return publicUrlData.publicUrl;
}


export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let user; 

    try {
        user = await getUser(req);
        if (!user) {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        
        // --- IMPORTANT: When handling FormData, Vercel automatically parses it.
        // req.body will directly contain the fields and files.
        const { action, name, acronym, teamId, existing_logo_url } = req.body;
        const logoFile = req.files && req.files.logoFile ? req.files.logoFile : null; // Access uploaded file


        switch (action) {
            // --- Case: Add a new Team ---
            case 'addTeam': {
                if (!name || !acronym || !logoFile) { // Logo is required for new team
                    return res.status(400).json({ error: 'Missing name, acronym, or logo file.' });
                }

                const logo_url = await uploadLogo(logoFile, 'team_logos');

                const { data, error } = await supabase
                    .from('teams')
                    .insert([{ name, acronym, logo_url }])
                    .select(); // Return the inserted data

                if (error) throw error;
                
                await logAction(user.id, 'addTeam', `Added new team: "${name}" (${acronym})`); 
                
                return res.status(200).json({ success: true, data: data[0] });
            }

            // --- NEW: Case: Edit an existing Team ---
            case 'editTeam': {
                if (!teamId || !name || !acronym) {
                    return res.status(400).json({ error: 'Missing team ID, name, or acronym for edit.' });
                }

                let logo_url_to_update = existing_logo_url; // Default to existing URL if no new file
                if (logoFile) { // If a new logo file is provided, upload it
                    logo_url_to_update = await uploadLogo(logoFile, 'team_logos');
                }

                const { data, error } = await supabase
                    .from('teams')
                    .update({ name, acronym, logo_url: logo_url_to_update })
                    .eq('id', teamId)
                    .select();

                if (error) throw error;

                const originalTeamName = await getTeamName(teamId); // Get name before update for log
                await logAction(user.id, 'editTeam', `Updated team ${originalTeamName} to "${name}" (${acronym})`);

                return res.status(200).json({ success: true, data: data[0] });
            }

            // --- NEW: Case: Delete a Team ---
            case 'deleteTeam': {
                if (!teamId) return res.status(400).json({ error: 'Team ID required for deletion.' });

                const teamName = await getTeamName(teamId); // Get name for log

                // OPTIONAL: Delete associated results first if you have foreign key constraints
                // await supabase.from('results').delete().eq('team_id', teamId);

                const { error } = await supabase.from('teams').delete().eq('id', teamId);
                
                if (error) throw error;
                
                await logAction(user.id, 'deleteTeam', `Deleted team: ${teamName}`);
                
                return res.status(200).json({ success: true });
            }


            // --- Case: Add a new Event ---
            case 'addEvent': {
                // This case handles JSON body, not FormData, so payload is directly req.body
                const { name: eventName, category_id, medal_value } = req.body; 
                if (!eventName || !category_id || isNaN(medal_value)) {
                    return res.status(400).json({ error: 'Missing required fields for event.' });
                }
                const { data, error } = await supabase
                    .from('events')
                    .insert([{ name: eventName, category_id, medal_value, status: 'ongoing' }])
                    .select();
                if (error) throw error;
                
                await logAction(user.id, 'addEvent', `Created new event: "${eventName}"`);
                
                return res.status(200).json({ success: true, data: data[0] });
            }

            // --- Case: Delete an Event ---
            case 'deleteEvent': {
                const { eventId } = req.body; // JSON body
                if (!eventId) return res.status(400).json({ error: 'Event ID required.' });
                
                const eventName = await getEventName(eventId);
                
                await supabase.from('results').delete().eq('event_id', eventId);
                const { error } = await supabase.from('events').delete().eq('id', eventId);
                
                if (error) throw error;
                
                await logAction(user.id, 'deleteEvent', `Deleted event: ${eventName}`);
                
                return res.status(200).json({ success: true });
            }
            
            // --- Case: Update an Event's Status ---
            case 'updateEventStatus': {
                const { eventId, newStatus } = req.body; // JSON body
                if (!eventId || !newStatus) return res.status(400).json({ error: 'Missing fields.' });
                
                const eventName = await getEventName(eventId);
                
                const { error } = await supabase
                    .from('events')
                    .update({ status: newStatus })
                    .eq('id', eventId);
                
                if (error) throw error;
                
                await logAction(user.id, 'updateEventStatus', `Set event ${eventName} to status: "${newStatus}"`);

                return res.status(200).json({ success: true });
            }

            // --- Case: Submit Event Results ---
            case 'submitResults': {
                const { eventId, results } = req.body; // JSON body
                if (!eventId || !results) return res.status(400).json({ error: 'Missing fields.' });

                const eventName = await getEventName(eventId);

                await supabase.from('results').delete().eq('event_id', eventId);
                const rowsToInsert = results.map(r => ({
                    event_id: eventId,
                    team_id: r.team_id,
                    rank: r.rank,
                    gold_awarded: r.gold_awarded,
                    silver_awarded: r.silver_awarded,
                    bronze_awarded: r.bronze_awarded
                }));
                const { error: insertError } = await supabase.from('results').insert(rowsToInsert);
                if (insertError) throw insertError;
                await supabase.from('events').update({ status: 'for review' }).eq('id', eventId);
                
                await logAction(user.id, 'submitResults', `Submitted/Updated results for event: ${eventName}`);

                return res.status(200).json({ success: true, message: 'Results submitted.' });
            }

            default:
                return res.status(400).json({ error: 'Invalid "action" parameter.' });
        }
    } catch (error) {
        console.error('Error in /api/actions:', error);
        if (user) {
            await logAction(user.id, 'error', `Failed action "${req.body.action || 'unknown'}": ${error.message}`);
        }
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};