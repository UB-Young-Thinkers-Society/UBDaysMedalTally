// This new file replaces 5 old files:
// - get-all-events.js
// - get-categories.js
// - get-event-results.js
// - get-medal-tally.js
// - get-teams.js

import { supabase } from './db_connection.js';

// Helper function to get the user from a token
async function getUser(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
}

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { type, eventId } = req.query;

        switch (type) {
            // --- Case: Get All Teams ---
            case 'teams': {
                const { data, error } = await supabase
                    .from('teams')
                    .select('id, name, acronym, logo_url');
                if (error) throw error;
                return res.status(200).json(data);
            }

            // --- Case: Get All Categories ---
            case 'categories': {
                const { data, error } = await supabase
                    .from('categories')
                    .select('id, name');
                if (error) throw error;
                return res.status(200).json(data);
            }

            // --- Case: Get All Events (grouped by Category) ---
            case 'allEvents': {
                const { data, error } = await supabase
                    .from('categories')
                    .select('id, name, events ( id, name, status, medal_value )');
                if (error) throw error;
                return res.status(200).json(data);
            }

            // --- Case: Get Results for a specific Event ---
            case 'eventResults': {
                if (!await getUser(req)) {
                    return res.status(401).json({ error: 'Invalid token.' });
                }
                if (!eventId) {
                    return res.status(400).json({ error: 'Missing eventId.' });
                }
                const { data, error } = await supabase
                    .from('results')
                    .select('rank, teams ( id, name, acronym, logo_url )')
                    .eq('event_id', eventId)
                    .order('rank', { ascending: true });
                if (error) throw error;
                return res.status(200).json(data);
            }
            
            // --- Case: Get the Live Medal Tally ---
            case 'medalTally': {
                const { data: teams, error } = await supabase
                    .from('teams')
                    .select('id, name, acronym, logo_url, results!inner(events!inner(status), gold_awarded, silver_awarded, bronze_awarded)')
                    .eq('results.events.status', 'published');
                if (error) throw error;

                const { data: allTeams, error: allTeamsError } = await supabase
                    .from('teams').select('id, name, acronym, logo_url');
                if (allTeamsError) throw allTeamsError;

                const medalTallyMap = new Map();
                allTeams.forEach(team => medalTallyMap.set(team.id, { ...team, gold: 0, silver: 0, bronze: 0, total: 0 }));

                teams.forEach(team => {
                    const tally = medalTallyMap.get(team.id);
                    if (tally) {
                        tally.gold = team.results.reduce((sum, r) => sum + r.gold_awarded, 0);
                        tally.silver = team.results.reduce((sum, r) => sum + r.silver_awarded, 0);
                        tally.bronze = team.results.reduce((sum, r) => sum + r.bronze_awarded, 0);
                        tally.total = tally.gold + tally.silver + tally.bronze;
                    }
                });

                const medalTally = Array.from(medalTallyMap.values());
                medalTally.sort((a, b) => {
                    if (a.gold !== b.gold) return b.gold - a.gold;
                    if (a.silver !== b.silver) return b.silver - a.silver;
                    if (a.bronze !== b.bronze) return b.bronze - a.bronze;
                    return a.name.localeCompare(b.name);
                });
                return res.status(200).json(medalTally);
            }

            default:
                return res.status(400).json({ error: 'Invalid "type" parameter.' });
        }
    } catch (error) {
        console.error('Error in /api/data:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};