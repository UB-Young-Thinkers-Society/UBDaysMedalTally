// This is your merged API for all GET requests
// It handles fetching teams, categories, events, and results.
import { supabase } from './db_connection.js';

/**
 * Helper function to securely get the user from an auth token.
 * This is used for all admin/committee-only data.
 */
async function getUserFromToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Authorization header missing or invalid.');
    }
    const token = authHeader.split(' ')[1];
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        throw new Error('Invalid or expired token.');
    }
    return user;
}

/**
 * Helper function to build the medal tally.
 * Reused by 'medalTally' and 'categoryTally'.
 */
async function getMedalTally(categoryId = null) {
    // 1. Get all teams
    const { data: allTeams, error: allTeamsError } = await supabase
        .from('teams')
        .select('id, name, acronym, logo_url');
    if (allTeamsError) throw allTeamsError;

    // 2. Get all published results, with an optional category filter
    let query = supabase
        .from('results')
        .select(`
            team_id,
            gold_awarded,
            silver_awarded,
            bronze_awarded,
            events!inner( status, category_id )
        `)
        .eq('events.status', 'published');
    
    if (categoryId) {
        query = query.eq('events.category_id', categoryId);
    }

    const { data: publishedResults, error: resultsError } = await query;
    if (resultsError) throw resultsError;

    // 3. Create a map of all teams to initialize their counts
    const tallyMap = new Map();
    allTeams.forEach(team => {
        tallyMap.set(team.id, {
            ...team,
            gold: 0,
            silver: 0,
            bronze: 0,
            total: 0
        });
    });

    // 4. Sum the medals from the published results
    publishedResults.forEach(result => {
        if (tallyMap.has(result.team_id)) {
            const team = tallyMap.get(result.team_id);
            team.gold += result.gold_awarded;
            team.silver += result.silver_awarded;
            team.bronze += result.bronze_awarded;
        }
    });

    // 5. Convert map back to an array
    const medalTally = Array.from(tallyMap.values()).map(team => ({
        ...team,
        total: team.gold + team.silver + team.bronze
    }));
    
    // 6. Filter out teams with 0 total medals (for category tally)
    // For the main medal tally, we want all teams.
    const filteredTally = categoryId ? medalTally.filter(team => team.total > 0) : medalTally;

    // 7. Sort the final list
    filteredTally.sort((a, b) => {
        if (a.gold !== b.gold) return b.gold - a.gold;
        if (a.silver !== b.silver) return b.silver - a.silver;
        if (a.bronze !== b.bronze) return b.bronze - a.bronze;
        return a.name.localeCompare(b.name);
    });
    
    return filteredTally;
}


// --- Main API Handler ---
export default async (req, res) => {
    try {
        const { type, eventId, categoryId } = req.query;

        switch (type) {
            
            // --- PUBLIC-FACING DATA (No Auth Required) ---

            case 'medalTally': {
                const tally = await getMedalTally(null);
                return res.status(200).json(tally);
            }

            case 'categoryTally': {
                if (!categoryId) return res.status(400).json({ error: 'Missing categoryId.' });
                const tally = await getMedalTally(categoryId);
                return res.status(200).json(tally);
            }

            // --- ADMIN/COMMITTEE DATA (Auth Required) ---
            
            case 'allEvents': {
                await getUserFromToken(req); // Auth check
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
                    .select(`
                        rank,
                        teams (
                            id,
                            name,
                            acronym,
                            logo_url
                        )
                    `)
                    .eq('event_id', eventId)
                    .order('rank', { ascending: true });
                if (error) throw error;
                return res.status(200).json(data);
            }
            
            default:
                return res.status(400).json({ error: 'Invalid data type requested.' });
        }
    } catch (error) {
        console.error('Error in /api/data:', error.message);
        // Differentiate between auth errors and server errors
        if (error.message.includes('token')) {
            return res.status(401).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};