// This is a secure serverless function (Node.js)
import { supabase } from './db_connection.js';

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // --- 1. AUTHENTICATE THE USER ---
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No authorization header.' });
        
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid token.' });
        }

        // --- 2. GET EVENT ID FROM QUERY ---
        const { eventId } = req.query;
        if (!eventId) {
            return res.status(400).json({ error: 'Missing eventId.' });
        }

        // --- 3. FETCH RESULTS AND JOIN WITH TEAMS ---
        // We query 'results' and use Supabase's 'join' feature
        // to also get the data from the 'teams' table.
        const { data, error } = await supabase
            .from('results')
            .select(`
                rank,
                team_id,
                teams (
                    id,
                    name,
                    acronym,
                    logo_url
                )
            `)
            .eq('event_id', eventId)
            .order('rank', { ascending: true }); // Order by rank

        if (error) throw error;

        // The data will look like:
        // [ { rank: 1, team_id: '...', teams: { id: '...', name: '...' } }, ... ]
        
        res.status(200).json(data);

    } catch (error) {
        console.error('Error in /api/get-event-results:', error);
        res.status(500).json({ error: error.message });
    }
};