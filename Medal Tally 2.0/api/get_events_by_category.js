// This is your NEW file: api/get-events-by-category.js
// (Assumes you have your Supabase client set up in a secure file)

import { supabase } from 'db_connection.js'; // Or wherever your secure client is

export default async function handler(req, res) {
    // 1. Get the category from the query parameter
    const { category } = req.query;

    if (!category) {
        return res.status(400).json({ error: 'Category is required' });
    }

    try {
        // 2. Have the DATABASE do the filtering
        const { data, error } = await supabase
            .from('events') // I recommend one 'events' table, not multiple
            .select('id, name, category, medal_count, status')
            .eq('category', category); // The database filter!

        if (error) throw error;
        
        // 3. Send only the filtered data back
        res.status(200).json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}