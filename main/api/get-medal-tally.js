// This is a secure serverless function (Node.js)
// It fetches all teams and calculates their *published* medal counts.
// We must import the server-side client from db_connection.js
import { supabase } from './db_connection.js';

export default async (req, res) => {
    try {
        // 1. Fetch all teams AND their associated results,
        // BUT only the results from events that are 'published'.
        
        // This is a complex query:
        // - from 'teams', select all columns
        // - also select from 'results' (where team.id = results.team_id)
        // - from those results, also select the 'events' (where results.event_id = events.id)
        // - and filter those events to ONLY get ones where status is 'published'
        const { data: teams, error } = await supabase
            .from('teams')
            .select(`
                id,
                name,
                acronym,
                logo_url,
                results (
                    gold_awarded,
                    silver_awarded,
                    bronze_awarded,
                    events!inner ( status )
                )
            `)
            .eq('results.events.status', 'published'); // Only get results from published events

        if (error) throw error;

        // 2. Process the data
        // The query above only returns teams *with* published results.
        // We need to fetch *all* teams to include those with 0 medals.
        const { data: allTeams, error: allTeamsError } = await supabase
            .from('teams')
            .select('id, name, acronym, logo_url');

        if (allTeamsError) throw allTeamsError;

        // Create a tally map
        const medalTallyMap = new Map();
        allTeams.forEach(team => {
            medalTallyMap.set(team.id, {
                ...team,
                gold: 0,
                silver: 0,
                bronze: 0,
                total: 0
            });
        });

        // Add the medals from the 'published' results
        teams.forEach(team => {
            const tally = medalTallyMap.get(team.id);
            if (tally) {
                tally.gold = team.results.reduce((sum, r) => sum + r.gold_awarded, 0);
                tally.silver = team.results.reduce((sum, r) => sum + r.silver_awarded, 0);
                tally.bronze = team.results.reduce((sum, r) => sum + r.bronze_awarded, 0);
                tally.total = tally.gold + tally.silver + tally.bronze;
            }
        });

        // Convert map back to an array
        const medalTally = Array.from(medalTallyMap.values());

        // 3. Sort the final tally
        medalTally.sort((a, b) => {
            if (a.gold !== b.gold) return b.gold - a.gold; // Sort by Gold
            if (a.silver !== b.silver) return b.silver - a.silver; // Then by Silver
            if (a.bronze !== b.bronze) return b.bronze - a.bronze; // Then by Bronze
            return a.name.localeCompare(b.name); // Finally by name
        });

        // 4. Send the final, sorted list
        res.status(200).json(medalTally);

    } catch (error) {
        console.error('Error in /api/get-medal-tally:', error);
        res.status(500).json({ error: error.message });
    }
};