// This script runs on the public-facing live feed page.

// A simple lock to prevent multiple refreshes from running at the same time
let isUpdating = false;

// Store the last fetched data
let cachedTeams = []; 
// Default sort
let currentSortKey = 'gold'; 
// Default direction
let currentSortDirection = 'desc'; 

document.addEventListener('DOMContentLoaded', () => {
    // Run both functions immediately on page load
    fetchAndRenderTally(); // Fetches new data and renders
    updateTimestamp();
    setupSorting(); // Attaches click listeners to headers

    // Set an interval to refresh the DATA every minute (60,000 milliseconds)
    setInterval(() => {
        console.log("Refreshing data..."); // For testing, you can see this in the console
        fetchAndRenderTally();
    }, 60000); 
    
    // Set a new interval to refresh the TIME every second (1,000 milliseconds)
    setInterval(() => {
        updateTimestamp();
    }, 1000);
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
        minute: '2-digit',
        second: '2-digit' // Added seconds for a "real-time" feel
    };
    subtitle.textContent = `As of ${now.toLocaleDateString('en-US', options)}`;
}

/**
 * Attaches click event listeners to sortable table headers.
 */
function setupSorting() {
    document.querySelectorAll('.tally-table th.sortable').forEach(header => {
        header.addEventListener('click', () => {
            if (isUpdating) return; // Don't sort while animating

            const newSortKey = header.dataset.sortKey;

            // Determine new sort direction
            let newSortDirection;
            if (currentSortKey === newSortKey) {
                newSortDirection = currentSortDirection === 'desc' ? 'asc' : 'desc';
            } else {
                // Default to 'desc' for medal counts, 'asc' for names
                newSortDirection = newSortKey === 'name' ? 'asc' : 'desc';
            }
            
            currentSortKey = newSortKey;
            currentSortDirection = newSortDirection;

            // Update header styles
            updateHeaderStyles();

            // Re-render the table with the new sort, using cached data
            renderTable(); 
        });
    });
    updateHeaderStyles(); // Set initial default style
}

/**
 * Updates the CSS classes and attributes on headers to show sort arrows.
 */
function updateHeaderStyles() {
    document.querySelectorAll('.tally-table th.sortable').forEach(header => {
        if (header.dataset.sortKey === currentSortKey) {
            header.classList.add('sorted');
            header.dataset.sortDir = currentSortDirection;
        } else {
            header.classList.remove('sorted');
            header.removeAttribute('data-sort-dir');
        }
    });
}

/**
 * Fetches the calculated medal tally from our secure API.
 */
async function fetchAndRenderTally() {
    // Prevent function from running if it's already in progress
    if (isUpdating) return;
    isUpdating = true;

    try {
        // --- FIXED ---
        // This is the correct API endpoint
        const response = await fetch('/api/data?type=medalTally');
        // --- END FIXED ---
        
        if (!response.ok) {
            throw new Error('Failed to load data from the server.');
        }

        cachedTeams = await response.json(); // Store new data
        await renderTable(); // Render the new data

    } catch (error) {
        console.error('Error fetching medal tally:', error);
        const tbody = document.getElementById('tally-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600; color: red;">Error: ${error.message}</td></tr>`;
        }
    } finally {
        isUpdating = false; // Release the lock
    }
}

/**
 * Sorts, animates, and renders the `cachedTeams` data into the table.
 * This function is now separate so it can be called by both
 * `fetchAndRenderTally` (with new data) and `setupSorting` (with old data).
 */
async function renderTable() {
    isUpdating = true; // Lock the function

    const tbody = document.getElementById('tally-body');
    if (!tbody) {
        isUpdating = false;
        return;
    }

    // --- FLIP Animation Step 1: FIRST ---
    // Get the current position of all existing rows
    const oldPositions = new Map();
    const existingRows = new Map();
    tbody.querySelectorAll('tr[data-team-id]').forEach(row => {
        const id = row.dataset.teamId;
        oldPositions.set(id, row.getBoundingClientRect().top);
        existingRows.set(id, row);
    });

    // --- Sort the data ---
    cachedTeams.sort((a, b) => {
        const key = currentSortKey;
        const dir = currentSortDirection === 'asc' ? 1 : -1;

        if (key === 'name') {
            return a.name.localeCompare(b.name) * dir;
        } else {
            // Ensure values are numbers for correct sorting
            const valA = Number(a[key]) || 0;
            const valB = Number(b[key]) || 0;

            // Primary sort (e.g., 'gold')
            if (valA !== valB) {
                return (valA - valB) * dir;
            }
            
            // Tie-breaking logic:
            // Always sort by Gold (desc), then Silver (desc), then Bronze (desc)
            
            // Secondary sort (tie-breaker)
            if (key !== 'gold' && (Number(a.gold) || 0) !== (Number(b.gold) || 0)) {
                return (Number(a.gold) || 0) - (Number(b.gold) || 0) * -1; // Always desc
            }
            // Tertiary sort
            if (key !== 'silver' && (Number(a.silver) || 0) !== (Number(b.silver) || 0)) {
                return (Number(a.silver) || 0) - (Number(b.silver) || 0) * -1; // Always desc
            }
            // Quaternary sort
            if (key !== 'bronze' && (Number(a.bronze) || 0) !== (Number(b.bronze) || 0)) {
                return (Number(a.bronze) || 0) - (Number(b.bronze) || 0) * -1; // Always desc
            }
            
            // Final tie-breaker: name (asc)
            return a.name.localeCompare(b.name);
        }
    });
    // --- END Sort ---

    // Handle empty table state
    if (cachedTeams.length === 0 && existingRows.size === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600;">No teams or results found.</td></tr>`;
        isUpdating = false;
        return;
    }

    const rowsToAnimate = [];
    const fragment = document.createDocumentFragment();

    // --- Loop 1: Update, create, and order rows ---
    cachedTeams.forEach(team => {
        // Use acronym as a reliable ID
        const id = team.acronym; 
        if (!id) {
             console.warn("Team data missing acronym:", team);
             return; // Skip teams without an ID
        }

        let row = existingRows.get(id);
        const logo = team.logo_url || 'img/Login-Logo.png';
        
        // This is the HTML that will be rendered
        const rowHTML = `
            <td>
                <img src="${logo}" class="dept-logo" alt="${team.acronym} Logo" onerror="this.src='img/Login-Logo.png';">
                <span class="dept-name full-name">${team.name}</span>
                <span class="dept-name acronym">${team.acronym}</span>
            </td>
            <td class="gold">${team.gold}</td>
            <td class="silver">${team.silver}</td>
            <td class="bronze">${team.bronze}</td>
            <td class="total">${team.total}</td>
        `;

        if (row) {
            // Row exists: update its content and mark as handled
            existingRows.delete(id);
            // Check if content has changed to prevent unnecessary re-renders
            // This avoids re-rendering rows that haven't changed
            if (row.innerHTML.replace(/\s/g, '') !== rowHTML.replace(/\s/g, '')) {
                 row.innerHTML = rowHTML;
            }
        } else {
            // Row is new: create it
            row = document.createElement('tr');
            row.dataset.teamId = id;
            row.innerHTML = rowHTML;
            row.style.opacity = 0; // Start invisible for fade-in
        }
        
        rowsToAnimate.push({ row, id });
        fragment.appendChild(row); // Add to fragment in the new correct order
    });

    // --- Loop 2: Handle removed rows ---
    // Any rows left in existingRows are no longer in the data
    existingRows.forEach((row, id) => {
        row.classList.add('row-removing');
        setTimeout(() => row.remove(), 500); // Remove from DOM after animation
    });

    // --- DOM Update ---
    // Replace old content with the new, correctly-ordered fragment
    tbody.innerHTML = '';
    tbody.appendChild(fragment);

    // --- FLIP Animation Step 2 & 3: LAST & INVERT ---
    const rowsToPlay = [];
    rowsToAnimate.forEach(({ row, id }) => {
        const oldTop = oldPositions.get(id);
        const newTop = row.getBoundingClientRect().top;

        if (oldTop === undefined) {
            // New row: set up for fade-in and slide-up
            row.style.transform = 'translateY(10px)';
            row.style.transition = 'none';
            rowsToPlay.push(row);
        } else if (Math.abs(oldTop - newTop) > 1) { // Only animate if moved
            // Moved row: calculate difference and move it back
            const diff = oldTop - newTop;
            row.style.transform = `translateY(${diff}px)`;
            row.style.transition = 'none'; // No transition for the "invert" step
            rowsToPlay.push(row);
        } else {
            // Row didn't move, but might be new. Handle fade-in for new rows.
            if (row.style.opacity === '0') {
                 rowsToPlay.push(row);
            }
        }
    });

    // --- FLIP Animation Step 4: PLAY ---
    // Force a browser repaint before applying the "play" animation
    // This is a common trick to make sure the "invert" styles (transform)
    // are applied *before* the "play" styles (transition)
    tbody.offsetHeight; 

    rowsToPlay.forEach(row => {
        row.style.transition = 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out';
        row.style.transform = 'translateY(0)';
        row.style.opacity = 1;
    });

    // We're done, release the lock
    isUpdating = false;
}