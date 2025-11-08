// This is a secure serverless function (Node.js)
import { supabase } from './db_connection.js';

export default async (req, res) => {
    // This API is for reading public data, so we don't need
    // to check for an authenticated user.
    // We are using the SERVICE KEY to read from the table.

    try {
        const { data, error } = await supabase
            .from('categories')
            .select('id, name');

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};