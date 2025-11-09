// --- 1. GLOBAL VARIABLES ---------------------------
// Cache for all event data to avoid re-fetching
let allCategoriesAndEvents = [];
// NEW: To remember the last selected category
let currentCategoryId = null;

// --- 2. PAGE INITIALIZATION ------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load the "static" dropdowns (Categories and Teams)
    loadCategories();
    loadTeams();
    updateTimestamp(); // From your live-feed.js

    // 2. Add event listeners to the dropdowns
    document.getElementById('filter-category').addEventListener('change', handleCategoryChange);
    document.getElementById('filter-event').addEventListener('change', handleEventChange);
    // (We'll add a listener for the team dropdown later if needed)
});

function updateTimestamp() {
    const subtitle = document.getElementById('last-updated');
    if (!subtitle) return;
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    subtitle.textContent = `As of ${now.toLocaleDateString('en-US', options)}`;
}

// --- 3. DROPDOWN POPULATION FUNCTIONS --------------

/**
 * Fetches all categories AND their events.
 * Populates the first dropdown.
 * MODIFIED: This is now a public, non-authenticated call.
 */
async function loadCategories() {
    const selectEl = document.getElementById('filter-category');
    const eventSelectEl = document.getElementById('filter-event');
    
    try {
        // Use our merged API to get all categories and events in one go
        const response = await fetch('/api/data?type=allEvents'); // No auth needed
        if (!response.ok) throw new Error('Failed to load categories');
        
        allCategoriesAndEvents = await response.json();
        
        selectEl.innerHTML = '<option value="">Enter Event Category</option>'; // Reset
        
        allCategoriesAndEvents.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id; // The Category UUID
            option.textContent = cat.name;
            selectEl.appendChild(option);
        });
        
        selectEl.disabled = false;
        eventSelectEl.disabled = true; // Disabled until a category is chosen

    } catch (error) {
        console.error(error);
        selectEl.innerHTML = '<option value="">Error loading</option>';
    }
}

/**
 * Fetches all teams and populates the third dropdown.
 * MODIFIED: This is now a public, non-authenticated call.
 */
async function loadTeams() {
    const selectEl = document.getElementById('filter-department');
    
    try {
        const response = await fetch('/api/data?type=teams'); // No auth needed
        if (!response.ok) throw new Error('Failed to load teams');
        
        const teams = await response.json();
        
        selectEl.innerHTML = '<option value="">Enter Department</option>'; // Reset
        
        // Sort teams alphabetically by acronym
        teams.sort((a, b) => a.acronym.localeCompare(b.acronym));
        
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id; // The Team UUID
            option.textContent = `${team.acronym} - ${team.name}`;
            selectEl.appendChild(option);
        });
        selectEl.disabled = false;

    } catch (error) {
        console.error(error);
        selectEl.innerHTML = '<option value="">Error loading</option>';
    }
}

/**
 * MODIFIED: Populates events AND shows the category tally.
 */
function handleCategoryChange(e) {
    currentCategoryId = e.target.value; // NEW
    const eventSelectEl = document.getElementById('filter-event');
    const titleEl = document.getElementById('details-title');
    const tableBodyEl = document.getElementById('category-rankings-body');

    // Reset
    eventSelectEl.innerHTML = '<option value="">Enter Event</option>';
    eventSelectEl.disabled = true;
    titleEl.textContent = '';
    
    if (!currentCategoryId) {
        // "Enter Event Category" was selected
        tableBodyEl.innerHTML = '<tr><td colspan="2" class="details-message empty">Please select a category to see rankings.</td></tr>';
        return;
    }

    const category = allCategoriesAndEvents.find(cat => cat.id === currentCategoryId);
    
    if (category) {
        // Populate the events dropdown
        if (category.events.length > 0) {
            category.events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.id;
                option.textContent = event.name;
                eventSelectEl.appendChild(option);
            });
            eventSelectEl.disabled = false;
        } else {
            eventSelectEl.innerHTML = '<option value="">No events found</option>';
        }
        
        // Set title and fetch the NEW CATEGORY TALLY
        titleEl.textContent = category.name;
        fetchAndDisplayCategoryTally(currentCategoryId); // NEW
    }
}

// --- 4. RANKING DISPLAY LOGIC ----------------------

/**
 * MODIFIED: Now checks if an event is selected.
 * If not, it reverts to the CATEGORY tally.
 */
function handleEventChange(e) {
    const eventId = e.target.value;
    
    if (!eventId) {
        // "Enter Event" was selected, so revert to category tally
        if (currentCategoryId) {
            fetchAndDisplayCategoryTally(currentCategoryId);
        }
        return;
    }

    // Find the full event object
    let selectedEvent = null;
    for (const category of allCategoriesAndEvents) {
        const event = category.events.find(ev => ev.id === eventId);
        if (event) {
            selectedEvent = event;
            break;
        }
    }
    if (!selectedEvent) return;

    // An event was selected, so show event-specific rankings
    fetchAndDisplayEventRankings(selectedEvent);
}

/**
 * NEW: Fetches and renders the OVERALL TALLY for a category.
 */
async function fetchAndDisplayCategoryTally(categoryId) {
    const tableBodyEl = document.getElementById('category-rankings-body');
    tableBodyEl.innerHTML = '<tr><td colspan="2" class="details-message loading">Loading category tally...</td></tr>';
    
    try {
        // This is a public API endpoint, no auth needed
        const response = await fetch(`/api/data?type=categoryTally&categoryId=${categoryId}`);
        if (!response.ok) throw new Error('Failed to fetch category tally.');

        const tally = await response.json();
        
        if (tally.length === 0) {
            tableBodyEl.innerHTML = '<tr><td colspan="2" class="details-message empty">No published results for this category yet.</td></tr>';
            return;
        }

        // We have results! Render the tally table.
        // This reuses the table but shows medals instead of "1st, 2nd"
        tableBodyEl.innerHTML = ''; // Clear loading
        
        tally.forEach(team => {
            const tr = document.createElement('tr');
            
            // This table shows medal counts, not ranks
            tr.innerHTML = `
                <td>
                    <img src="${team.logo_url}" class="dept-logo" alt="${team.acronym} Logo" onerror="this.src='img/Login-Logo.png';">
                    <span class="dept-name">${team.name}</span>
                </td>
                <td class="rank-display">
                    <span class="gold">${team.gold} G</span> | 
                    <span class="silver">${team.silver} S</span> | 
                    <span class="bronze">${team.bronze} B</span>
                </td>
            `;
            tableBodyEl.appendChild(tr);
        });

    } catch (error) {
        console.error('Error fetching category tally:', error);
        tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message error">${error.message}</td></tr>`;
    }
}

/**
 * Fetches and renders the rankings for a SPECIFIC EVENT.
 * (This is your old 'fetchAndDisplayRankings' function)
 * MODIFIED: This is now a public, non-authenticated call.
 */
async function fetchAndDisplayEventRankings(event) {
    const tableBodyEl = document.getElementById('category-rankings-body');
    tableBodyEl.innerHTML = '<tr><td colspan="2" class="details-message loading">Loading event rankings...</td></tr>';
    
    // 1. Check status
    if (event.status !== 'published') {
        tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message empty">Results for this event are not yet published. The status is: ${event.status}</td></tr>`;
        return;
    }

    // 2. Status is 'published', so get results
    try {
        const response = await fetch(`/api/data?type=eventResults&eventId=${event.id}`); // No auth needed
        if (!response.ok) throw new Error('Failed to fetch results.');

        const results = await response.json();
        
        if (results.length === 0) {
            tableBodyEl.innerHTML = '<tr><td colspan="2" class="details-message empty">This event is published, but no rankings were submitted.</td></tr>';
            return;
        }

        // 3. We have results! Render the table.
        renderRankingsTable(results, tableBodyEl);

    } catch (error) {
        console.error('Error fetching rankings:', error);
        tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message error">${error.message}</td></tr>`;
    }
}

/**
 * Helper function to build the HTML for the EVENT rankings table.
 */
function renderRankingsTable(results, tableBodyEl) {
    tableBodyEl.innerHTML = ''; // Clear loading message
    
    results.forEach(result => {
        const team = result.teams;
        const tr = document.createElement('tr');
        
        let rankDisplay = `${result.rank}th`;
        let rankClass = '';
        if (result.rank === 1) { rankDisplay = '1st'; rankClass = 'gold'; }
        if (result.rank === 2) { rankDisplay = '2nd'; rankClass = 'silver'; }
        if (result.rank === 3) { rankDisplay = '3rd'; rankClass = 'bronze'; }

        tr.innerHTML = `
            <td>
                <img src="${team.logo_url}" class="dept-logo" alt="${team.acronym} Logo" onerror="this.src='img/Login-Logo.png';">
                <span class="dept-name">${team.name}</span>
            </td>
            <td class="rank-display ${rankClass}">${rankDisplay}</td>
        `;
        tableBodyEl.appendChild(tr);
    });
}