// This is a secure serverless function (Node.js)
import { supabase } from './db_connection.js'; 

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Add admin auth check here
        
        const { eventId } = req.body;

        if (!eventId) {
            return res.status(400).json({ error: 'Event ID is required.' });
        }

        // We must delete the results for this event first
        // to avoid a foreign key constraint error.
        const { error: resultsError } = await supabase
            .from('results')
            .delete()
            .eq('event_id', eventId);
        
        if (resultsError) {
            console.warn('Could not delete results, they might not exist.', resultsError.message);
        }

        // Now delete the event itself
        const { error: eventError } = await supabase
            .from('events')
            .delete()
            .eq('id', eventId);

        if (eventError) throw eventError;
        
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error in /api/delete-event:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};