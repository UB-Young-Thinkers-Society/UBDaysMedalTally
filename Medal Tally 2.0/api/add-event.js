// This is a secure serverless function (Node.js)
import { supabase } from './db_connection.js';

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // This is simple because it's JSON
        const { name, category_id, medal_value } = req.body;

        if (!name || !category_id || isNaN(medal_value)) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        // Insert into the NEW 'events' table
        const { data, error } = await supabase
            .from('events')
            .insert([
                {
                    name: name,
                    category_id: category_id,
                    medal_value: medal_value,
                    status: 'ongoing' // Set default status
                }
            ])
            .select();

        if (error) throw error;

        res.status(200).json({ success: true, data: data[0] });

    } catch (error) {
        console.error('Error in /api/add-event:', error);
        res.status(500).json({ error: error.message });
    }
};