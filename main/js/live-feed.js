// This script runs on the public-facing live feed page.

document.addEventListener('DOMContentLoaded', () => {
    // Run both functions immediately on page load
    fetchAndRenderTally();
    updateTimestamp();

    // --- ADDED ---
    // Set an interval to refresh the data every minute (60,000 milliseconds)
    setInterval(() => {
        console.log("Refreshing data..."); // For testing, you can see this in the console
        fetchAndRenderTally();
        updateTimestamp();
    }, 60000); 
    // --- END ADDED ---
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
    subtitle.textContent = `As/ of ${now.toLocaleDateString('en-US', options)}`;
}

/**
 * Fetches the calculated medal tally from our secure API
 * and renders the HTML table.
 */
async function fetchAndRenderTally() {
    const tbody = document.getElementById('tally-body');
    
    // --- MODIFIED ---
    // Keep track of scroll position and currently focused element
    const scrollY = window.scrollY;
    const activeElement = document.activeElement;
    // --- END MODIFIED ---

    try {
        const response = await fetch('/api/data?type=medalTally');
        if (!response.ok) {
            throw new Error('Failed to load data from the server.');
        }

        const teams = await response.json();

        // Clear the "Loading..." message
        tbody.innerHTML = '';

        if (teams.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600;">No teams or results found.</td></tr>`;
            return;
        }

        // Build a new table row for each team
        teams.forEach(team => {
            const tr = document.createElement('tr');
            
            // Use a fallback logo if 'logo_url' is null or empty
            const logo = team.logo_url || 'img/Login-Logo.png'; 

            tr.innerHTML = `
                <td>
                    <img src="${logo}" class="dept-logo" alt="${team.acronym} Logo" onerror="this.src='img/Login-Logo.png';">
                    <!-- MODIFIED: Added both full name and acronym in separate spans -->
                    <span class="dept-name full-name">${team.name}</span>
                    <span class="dept-name acronym">${team.acronym}</span>
                </td>
                <td class="gold">${team.gold}</td>
                <td class="silver">${team.silver}</td>
                <td class="bronze">${team.bronze}</td>
                <td class="total">${team.total}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error fetching medal tally:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600; color: red;">Error: ${error.message}</td></tr>`;
    } finally {
        // --- ADDED ---
        // Restore scroll position and focus to prevent page jump
        window.scrollTo(0, scrollY);
        if (activeElement && activeElement.focus) {
            activeElement.focus();
        }
        // --- END ADDED ---
    }
}