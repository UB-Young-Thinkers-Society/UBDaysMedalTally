// This script runs on the public-facing live feed page.

document.addEventListener('DOMContentLoaded', () => {
    // Run both functions immediately on page load
    fetchAndRenderTally();
    updateTimestamp();

    // Set an interval to refresh DATA and TIME every minute (60,000 milliseconds)
    setInterval(() => {
        console.log("Refreshing data..."); // For testing
        fetchAndRenderTally();
        updateTimestamp(); // Update timestamp with data
    }, 60000); 
});

/**
 * Updates the "As of..." subtitle with the current date and time.
 */
function updateTimestamp() {
    const subtitle = document.getElementById('last-updated');
    if (!subtitle) return;

    const now = new Date();
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
    };
    subtitle.textContent = `As of ${now.toLocaleDateString('en-US', options)}`;
}

/**
 * Fetches, sorts, and renders the calculated medal tally.
 */
async function fetchAndRenderTally() {
    const tbody = document.getElementById('tally-body');
    if (!tbody) return;

    try {
        const response = await fetch('/api/data?type=medalTally');
        
        if (!response.ok) {
            throw new Error('Failed to load data from the server.');
        }

        let teams = await response.json(); // Get data

        // Sort the data by Gold (desc), then Silver (desc), then Bronze (desc)
        teams.sort((a, b) => {
            const valA = {
                gold: Number(a.gold) || 0,
                silver: Number(a.silver) || 0,
                bronze: Number(a.bronze) || 0,
            };
            const valB = {
                gold: Number(b.gold) || 0,
                silver: Number(b.silver) || 0,
                bronze: Number(b.bronze) || 0,
            };

            if (valA.gold !== valB.gold) {
                return valB.gold - valA.gold; // Desc gold
            }
            if (valA.silver !== valB.silver) {
                return valB.silver - valA.silver; // Desc silver
            }
            if (valA.bronze !== valB.bronze) {
                return valB.bronze - valA.bronze; // Desc bronze
            }
            return a.name.localeCompare(b.name); // Asc name as final tie-break
        });

        // Clear the table body
        tbody.innerHTML = '';

        // Handle empty table state
        if (teams.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600;">No teams or results found.</td></tr>`;
            return;
        }

        // Build a new table row for each team
        teams.forEach(team => {
            const row = document.createElement('tr');
            
            // Use acronym as a reliable ID (for potential future use, good practice)
            if (team.acronym) {
                row.dataset.teamId = team.acronym;
            }

            const logo = team.logo_url || 'img/Login-Logo.png';
            
            // This is the HTML that will be rendered
            row.innerHTML = `
                <td>
                    <img src="${logo}" class="dept-logo" alt="${team.acronym} Logo" onerror="this.src='img/Login-Logo.png';">
                    <span class="dept-name full-name">${team.name}</span>
                    <span class="dept-name acronym">${team.acronym}</span>
                </td>
                <!-- MODIFIED: Wrapped medal counts in divs with specific classes --><td><div class="medal-circle gold">${team.gold}</div></td>
                <td><div class="medal-circle silver">${team.silver}</div></td>
                <td><div class="medal-circle bronze">${team.bronze}</div></td>
                <td><div class="medal-circle total">${team.total}</div></td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Error fetching medal tally:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600; color: red;">Error: ${error.message}</td></tr>`;
        }
    }
}