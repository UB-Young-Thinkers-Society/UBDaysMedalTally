// This new file replaces 4 old files:
// - add-event.js
// - delete-event.js
// - submit-results.js
// - update-event-status.js (which we built)

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

// --- NEW HELPER ---
// Helper function to get an event's name from its ID
async function getEventName(eventId) {
    if (!eventId) return 'unknown_event';
    try {
        const { data, error } = await supabase
            .from('events')
            .select('name')
            .eq('id', eventId)
            .single(); // Get just one record
            
        if (error || !data) {
            console.error('Error fetching event name:', error);
            return `Event ID ${eventId}`; // Fallback if not found
        }
        // Return the name, e.g., "Basketball"
        return `"${data.name}"`; 
    } catch (err) {
        console.error('Exception fetching event name:', err);
        return `Event ID ${eventId}`; // Fallback on exception
    }
}

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let user; 

    try {
        // Authenticate the user for all actions
        user = await getUser(req);
        if (!user) {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        
        const { action, ...payload } = req.body;

        switch (action) {
            // --- Case: Add a new Event ---
            // (This case is already correct, as it has the 'name')
            case 'addEvent': {
                const { name, category_id, medal_value } = payload;
                if (!name || !category_id || isNaN(medal_value)) {
                    return res.status(400).json({ error: 'Missing required fields.' });
                }
                const { data, error } = await supabase
                    .from('events')
                    .insert([{ name, category_id, medal_value, status: 'ongoing' }])
                    .select();
                if (error) throw error;
                
                // No change needed here
                await logAction(user.id, 'addEvent', `Created new event: "${name}"`);
                
                return res.status(200).json({ success: true, data: data[0] });
            }

            // --- Case: Delete an Event ---
            case 'deleteEvent': {
                const { eventId } = payload;
                if (!eventId) return res.status(400).json({ error: 'Event ID required.' });
                
                // --- ADDED: Get name *before* deleting ---
                const eventName = await getEventName(eventId);
                
                await supabase.from('results').delete().eq('event_id', eventId);
                const { error } = await supabase.from('events').delete().eq('id', eventId);
                
                if (error) throw error;
                
                // --- CHANGED ---
                await logAction(user.id, 'deleteEvent', `Deleted event: ${eventName}`);
                
                return res.status(200).json({ success: true });
            }
            
            // --- Case: Update an Event's Status ---
            case 'updateEventStatus': {
                const { eventId, newStatus } = payload;
                if (!eventId || !newStatus) return res.status(400).json({ error: 'Missing fields.' });
                
                // --- ADDED: Get name ---
                const eventName = await getEventName(eventId);
                
                const { error } = await supabase
                    .from('events')
                    .update({ status: newStatus })
                    .eq('id', eventId);
                
                if (error) throw error;
                
                // --- CHANGED ---
                await logAction(user.id, 'updateEventStatus', `Set event ${eventName} to status: "${newStatus}"`);

                return res.status(200).json({ success: true });
            }

            // --- Case: Submit Event Results ---
            case 'submitResults': {
                const { eventId, results } = payload;
                if (!eventId || !results) return res.status(400).json({ error: 'Missing fields.' });

                // --- ADDED: Get name ---
                const eventName = await getEventName(eventId);

                // (All the results logic is unchanged)
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
                
                // --- CHANGED ---
                await logAction(user.id, 'submitResults', `Submitted/Updated results for event: ${eventName}`);

                return res.status(200).json({ success: true, message: 'Results submitted.' });
            }

            default:
                return res.status(400).json({ error: 'Invalid "action" parameter.' });
        }
    } catch (error) {
        console.error('Error in /api/actions:', error);
        if (user) {
            await logAction(user.id, 'error', `Failed action "${req.body.action}": ${error.message}`);
        }
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};