// --- 1. GLOBAL VARIABLES ---------------------------
// Cache for all event data to avoid re-fetching
let allCategoriesAndEvents = [];

// --- 2. PAGE INITIALIZATION ------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load the "static" dropdowns (Categories and Teams)
    loadCategories();
    loadTeams();
    updateTimestamp();

    // 2. Add event listeners to the dropdowns
    document.getElementById('filter-category').addEventListener('change', handleCategoryChange);
    document.getElementById('filter-event').addEventListener('change', handleEventChange);
    // (We'll add a listener for the team dropdown later)
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
 */
async function loadCategories() {
    const selectEl = document.getElementById('filter-category');
    const eventSelectEl = document.getElementById('filter-event');
    
    try {
        // Use our merged API to get all categories and events in one go
        const response = await fetch('/api/data?type=allEvents');
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
 */
async function loadTeams() {
    const selectEl = document.getElementById('filter-department');
    
    try {
        const response = await fetch('/api/data?type=teams');
        if (!response.ok) throw new Error('Failed to load teams');
        
        const teams = await response.json();
        
        selectEl.innerHTML = '<option value="">Enter Department</option>'; // Reset
        
        teams.sort((a, b) => a.acronym.localeCompare(b.acronym)); // Sort by acronym
        
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
 * Populates the 'Events' dropdown based on the selected category.
 */
function handleCategoryChange(e) {
    const categoryId = e.target.value;
    const eventSelectEl = document.getElementById('filter-event');
    const titleEl = document.getElementById('details-title');
    const tableBodyEl = document.getElementById('category-rankings-body');

    // Reset everything
    eventSelectEl.innerHTML = '<option value="">Enter Event</option>';
    eventSelectEl.disabled = true;
    titleEl.textContent = '';
    tableBodyEl.innerHTML = '<tr><td colspan="2" class="details-message empty">Please select an event to see rankings.</td></tr>';

    if (!categoryId) return; // "Enter Event Category" was selected

    // Find the category in our cached data
    const category = allCategoriesAndEvents.find(cat => cat.id === categoryId);
    
    if (category && category.events.length > 0) {
        // Populate the events dropdown
        category.events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = event.name;
            eventSelectEl.appendChild(option);
        });
        eventSelectEl.disabled = false;
        titleEl.textContent = category.name; // Set the main title
    } else if (category) {
        eventSelectEl.innerHTML = '<option value="">No events found</option>';
        titleEl.textContent = category.name;
    }
}

// --- 4. RANKING DISPLAY LOGIC ----------------------

/**
 * Called when an event is selected from the second dropdown.
 */
function handleEventChange(e) {
    const eventId = e.target.value;
    if (!eventId) {
        // "Enter Event" was selected, so clear the table
        document.getElementById('category-rankings-body').innerHTML = '<tr><td colspan="2" class="details-message empty">Please select an event to see rankings.</td></tr>';
        return;
    }

    // Find the full event object from our cache
    let selectedEvent = null;
    for (const category of allCategoriesAndEvents) {
        const event = category.events.find(ev => ev.id === eventId);
        if (event) {
            selectedEvent = event;
            break;
        }
    }

    if (!selectedEvent) {
        console.error('Could not find event data for ID:', eventId);
        return;
    }

    // Now, fetch and display the rankings for this event
    fetchAndDisplayRankings(selectedEvent);
}

/**
 * Fetches and renders the rankings for a specific event.
 */
async function fetchAndDisplayRankings(event) {
    const tableBodyEl = document.getElementById('category-rankings-body');
    tableBodyEl.innerHTML = '<tr><td colspan="2" class="details-message loading">Loading rankings...</td></tr>';
    
    // 1. Check the event status FIRST
    if (event.status !== 'published') {
        tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message empty">Results for this event are not yet published. The status is: ${event.status}</td></tr>`;
        return;
    }

    // 2. Status is 'published', so get the results
    try {
        // We use the 'eventResults' type for our merged API
        const response = await fetch(`/api/data?type=eventResults&eventId=${event.id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch results.');
        }

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
 * Helper function to build the HTML for the rankings table.
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