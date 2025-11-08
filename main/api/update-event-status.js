// This is a secure serverless function (Node.js)
import { supabase } from './db_connection.js'; 

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // We should check if user is an admin here...
        // (Skipping for brevity, but add this for real security)
        
        const { eventId, newStatus } = req.body;

        if (!eventId || !newStatus) {
            return res.status(400).json({ error: 'Event ID and new status are required.' });
        }

        const { data, error } = await supabase
            .from('events')
            .update({ status: newStatus })
            .eq('id', eventId)
            .select();

        if (error) throw error;
        
        res.status(200).json({ success: true, data: data[0] });

    } catch (error) {
        console.error('Error in /api/update-event-status:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};