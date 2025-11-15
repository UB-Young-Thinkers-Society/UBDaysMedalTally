// This is your merged API for all GET requests
import { supabase } from './db_connection.js';

/**
 * Helper function to securely get the user from an auth token.
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
 */
async function getMedalTally(categoryId = null) {
    const { data: allTeams, error: allTeamsError } = await supabase
        .from('teams')
        .select('id, name, acronym, logo_url');
    if (allTeamsError) throw allTeamsError;

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

    const filteredTally = categoryId ? medalTally.filter(team => team.total > 0) : medalTally;

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
        const { type, eventId, categoryId, teamId } = req.query; // Added teamId

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
            case 'allEvents': {
                const { data, error } = await supabase
                    .from('categories')
                    .select(`id, name, events (id, name, status, medal_value)`);
                if (error) throw error;
                return res.status(200).json(data);
            }
            case 'categories': {
                const { data, error } = await supabase.from('categories').select('id, name');
                if (error) throw error;
                return res.status(200).json(data);
            }
            case 'teams': {
                const { data, error } = await supabase.from('teams').select('id, name, acronym, logo_url');
                if (error) throw error;
                return res.status(200).json(data);
            }
            case 'eventResults': {
                if (!eventId) return res.status(400).json({ error: 'Missing eventId.' });
                const { data, error } = await supabase
                    .from('results')
                    .select('rank, teams (id, name, acronym, logo_url)')
                    .eq('event_id', eventId)
                    .order('rank', { ascending: true });
                if (error) throw error;
                return res.status(200).json(data);
            }
            case 'departmentResults': {
                if (!teamId) {
                    return res.status(400).json({ error: 'Missing teamId.' });
                }

                // Get all results for this team from published events
                const { data, error } = await supabase
                    .from('results')
                    .select(`
                        gold_awarded,
                        silver_awarded,
                        bronze_awarded,
                        events!inner (
                            name,
                            categories ( name )
                        )
                    `)
                    .eq('team_id', teamId)
                    .eq('events.status', 'published');
                
                if (error) throw error;
                
                // We have the results, now let's get the team's info
                const { data: teamInfo, error: teamError } = await supabase
                    .from('teams')
                    .select('name, logo_url, acronym')
                    .eq('id', teamId)
                    .single(); // Get just one team

                if (teamError) throw teamError;

                // Group the results by category
                const categories = {};
                data.forEach(r => {
                    const categoryName = r.events.categories.name;
                    if (!categories[categoryName]) {
                        categories[categoryName] = [];
                    }
                    categories[categoryName].push({
                        event_name: r.events.name,
                        gold: r.gold_awarded,
                        silver: r.silver_awarded,
                        bronze: r.bronze_awarded
                    });
                });
                
                // Calculate totals
                const totalGold = data.reduce((sum, r) => sum + r.gold_awarded, 0);
                const totalSilver = data.reduce((sum, r) => sum + r.silver_awarded, 0);
                const totalBronze = data.reduce((sum, r) => sum + r.bronze_awarded, 0);

                // Send the final payload
                res.status(200).json({
                    teamInfo,
                    totals: { totalGold, totalSilver, totalBronze },
                    categories
                });
                break;
            }

            // --- *** UPDATED CASE FOR THE LOG PAGE *** ---
            case 'getLogs': {
                let user;
                try {
                    // Step 1. Still authenticate the user to protect the endpoint
                    user = await getUserFromToken(req);
                
                } catch (authError) {
                    console.error('getLogs Authentication Error:', authError.message);
                    return res.status(401).json({ error: authError.message });
                }

                try {
                    // Step 2. Call the new SQL function
                    // .rpc() calls a remote procedure (our new function)
                    const { data, error } = await supabase
                        .rpc('get_audit_logs');

                    if (error) throw error; // Throw DB errors to the catch block
                    
                    // The data is already perfectly formatted by our SQL function.
                    // No need to .map() it, just send it.
                    return res.status(200).json(data);

                } catch (dbError) {
                    // This will catch errors from the .rpc() call
                    console.error('getLogs Database Error:', dbError.message);
                    return res.status(500).json({ error: dbError.message });
                }
            }
            // --- *** END OF UPDATED CASE *** ---

            default:
                return res.status(400).json({ error: 'Invalid data type requested.' });
        }
    } catch (error) {
        console.error('Error in /api/data:', error.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};