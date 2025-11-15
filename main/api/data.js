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
    // ... (This function is unchanged, content omitted for brevity) ...
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
            
            // ... (All other cases are unchanged, content omitted for brevity) ...

            case 'departmentResults': {
                // ... (content omitted for brevity)
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