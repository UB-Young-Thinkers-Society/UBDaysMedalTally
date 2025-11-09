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
                    .from('teams')
                    .select('id, name, acronym, logo_url');
                if (allTeamsError) throw allTeamsError;

                const { data: publishedResults, error: resultsError } = await supabase
                    .from('results')
                    .select(`
                        team_id,
                        gold_awarded,
                        silver_awarded,
                        bronze_awarded,
                        events!inner( status )
                    `)
                    .eq('events.status', 'published');
                if (resultsError) throw resultsError;

                const tallyMap = new Map();
                allTeams.forEach(team => {
                    tallyMap.set(team.id, { ...team, gold: 0, silver: 0, bronze: 0, total: 0 });
                });

                publishedResults.forEach(result => {
                    if (tallyMap.has(result.team_id)) {
                        const team = tallyMap.get(result.team_id);
                        team.gold += result.gold_awarded;
                        team.silver += result.silver_awarded;
                        team.bronze += result.bronze_awarded;
                    }
                });

                const medalTally = Array.from(tallyMap.values()).map(team => ({
                    ...team,
                    total: team.gold + team.silver + team.bronze
                }));

                medalTally.sort((a, b) => {
                    if (a.gold !== b.gold) return b.gold - a.gold;
                    if (a.silver !== b.silver) return b.silver - a.silver;
                    if (a.bronze !== b.bronze) return b.bronze - a.bronze;
                    return a.name.localeCompare(b.name);
                });
                
                return res.status(200).json(medalTally);
            }

            // --- NEW CASE FOR CATEGORY TALLY (Public) ---
            case 'categoryTally': {
                if (!categoryId) {
                    return res.status(400).json({ error: 'Missing categoryId.' });
                }

                // This is the same logic as 'medalTally', but filtered by category.
                const { data: allTeams, error: allTeamsError } = await supabase
                    .from('teams')
                    .select('id, name, acronym, logo_url');
                if (allTeamsError) throw allTeamsError;

                // 1. Get all published results...
                // 2. ...where the event's category_id matches.
                const { data: publishedResults, error: resultsError } = await supabase
                    .from('results')
                    .select(`
                        team_id,
                        gold_awarded,
                        silver_awarded,
                        bronze_awarded,
                        events!inner( status, category_id )
                    `)
                    .eq('events.status', 'published')
                    .eq('events.category_id', categoryId); // <-- The new filter
                
                if (resultsError) throw resultsError;

                // --- Calculate Tally (same as before) ---
                const tallyMap = new Map();
                allTeams.forEach(team => {
                    tallyMap.set(team.id, { ...team, gold: 0, silver: 0, bronze: 0, total: 0 });
                });

                publishedResults.forEach(result => {
                    if (tallyMap.has(result.team_id)) {
                        const team = tallyMap.get(result.team_id);
                        team.gold += result.gold_awarded;
                        team.silver += result.silver_awarded;
                        team.bronze += result.bronze_awarded;
                    }
                });

                const medalTally = Array.from(tallyMap.values()).map(team => ({
                    ...team,
                    total: team.gold + team.silver + team.bronze
                }));

                // Filter out teams with 0 total medals *for this category*
                const filteredTally = medalTally.filter(team => team.total > 0);

                filteredTally.sort((a, b) => {
                    if (a.gold !== b.gold) return b.gold - a.gold;
                    if (a.silver !== b.silver) return b.silver - a.silver;
                    if (a.bronze !== b.bronze) return b.bronze - a.bronze;
                    return a.name.localeCompare(b.name);
                });
                
                return res.status(200).json(filteredTally);
            }

            // --- ADMIN/COMMITTEE DATA (Auth Required) ---
            case 'allEvents': {
                await getUserFromToken(req); // Auth check
                const { data, error } = await supabase
                    .from('categories')
                    .select('id, name, events ( id, name, status, medal_value )');
                if (error) throw error;
                return res.status(200).json(data);
            }
            case 'categories': {
                await getUserFromToken(req); // Auth check
                const { data, error } = await supabase.from('categories').select('id, name');
                if (error) throw error;
                return res.status(200).json(data);
            }
            case 'teams': {
                await getUserFromToken(req); // Auth check
                const { data, error } = await supabase.from('teams').select('id, name, acronym, logo_url');
                if (error) throw error;
                return res.status(200).json(data);
            }
            case 'eventResults': {
                await getUserFromToken(req); // Auth check
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

            default:
                return res.status(400).json({ error: 'Invalid "type" parameter.' });
        }
    } catch (error) {
        console.error('Error in /api/data:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};