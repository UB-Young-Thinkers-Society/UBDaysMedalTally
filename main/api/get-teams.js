// This is a secure serverless function (Node.js)
import { supabase } from './db_connection.js';

export default async (req, res) => {
    try {
        // Use the new 'teams' table
        const { data, error } = await supabase
            .from('teams')
            .select('id, name, acronym, logo_url'); // use new 'logo_url' column

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};