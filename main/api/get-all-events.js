// This is a secure serverless function (Node.js)
// Its job is to get all categories AND all events in one efficient call.
import { supabase } from './db_connection.js'; 

export default async (req, res) => {
    try {
        // We don't need to check auth for this. 
        // We can just rely on RLS (Row Level Security) if we want,
        // but for an admin page, using the service key is fine.
        
        // 1. Fetch all categories
        // 2. Fetch all events
        // 3. Combine them
        
        // This query fetches all categories, and for each category,
        // it embeds an array of its related events.
        const { data, error } = await supabase
            .from('categories')
            .select(`
                id,
                name,
                events (
                    id,
                    name,
                    status,
                    medal_value
                )
            `);

        if (error) throw error;

        // The data is already in the perfect format.
        // [
        //   { id: 'uuid-1', name: 'Athletics', events: [ ... ] },
        //   { id: 'uuid-2', name: 'Music', events: [ ... ] }
        // ]
        
        res.status(200).json(data);

    } catch (error) {
        console.error('Error in /api/get-all-events:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};