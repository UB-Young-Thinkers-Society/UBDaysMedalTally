// This is a secure serverless function (Node.js)
import { supabase } from './db_connection.js';

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method NotAllowed' });
    }

    try {
        // --- 1. AUTHENTICATE THE USER ---
        // Get the token from the 'Authorization' header
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No authorization header.' });
        
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError) return res.status(401).json({ error: 'Invalid token.' });

        // (Optional but recommended) Check if user is 'committee' or 'admin'
        // This requires another query to your 'user-roles' table
        
        // --- 2. PARSE THE DATA ---
        const { eventId, results } = req.body;

        if (!eventId || !results || results.length === 0) {
            return res.status(400).json({ error: 'Missing eventId or results data.' });
        }

        // --- 3. DATABASE OPERATIONS ---
        
        // Step A: Delete all existing results for this event
        const { error: deleteError } = await supabase
            .from('results')
            .delete()
            .eq('event_id', eventId);
            
        if (deleteError) {
            console.error('Error deleting old results:', deleteError);
            throw new Error('Could not clear old results: ' + deleteError.message);
        }
            
        // Step B: Format and insert all new results
        const rowsToInsert = results.map(r => ({
            event_id: eventId,
            team_id: r.team_id,
            rank: r.rank,
            gold_awarded: r.gold_awarded,
            silver_awarded: r.silver_awarded,
            bronze_awarded: r.bronze_awarded
        }));

        const { error: insertError } = await supabase
            .from('results')
            .insert(rowsToInsert);

        if (insertError) {
            console.error('Error inserting new results:', insertError);
            throw new Error('Could not save new results: ' + insertError.message);
        }

        // Step C: Update the event's status to 'for review'
        const { error: updateError } = await supabase
            .from('events')
            .update({ status: 'for review' })
            .eq('id', eventId);

        if (updateError) {
            console.error('Error updating event status:', updateError);
            // This is a non-critical error, so we'll just log it
            // and still return success to the user.
        }

        // --- 4. SUCCESS ---
        res.status(200).json({ success: true, message: 'Results submitted successfully.' });

    } catch (error) {
        console.error('Error in /api/submit-results:', error);
        res.status(500).json({ error: error.message });
    }
};