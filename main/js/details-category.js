// --- 1. GLOBAL VARIABLES ---------------------------
let allCategoriesAndEvents = [];
let currentCategoryId = null; // NEW: To remember the last selected category

// --- 2. PAGE INITIALIZATION ------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadTeams();
    updateTimestamp();

    document.getElementById('filter-category').addEventListener('change', handleCategoryChange);
    document.getElementById('filter-event').addEventListener('change', handleEventChange);
});

function updateTimestamp() {
    const subtitle = document.getElementById('last-updated');
    if (!subtitle) return;
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    subtitle.textContent = `As of ${now.toLocaleDateString('en-US', options)}`;
}

// --- 3. DROPDOWN POPULATION FUNCTIONS --------------

async function loadCategories() {
    const selectEl = document.getElementById('filter-category');
    const eventSelectEl = document.getElementById('filter-event');
    
    try {
        // We need auth to get the event list for the dropdowns
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');
        
        const response = await fetch('/api/data?type=allEvents', {
            headers: { 'Authorization': `Bearer ${sessionData.session.access_token}` }
        });
        if (!response.ok) throw new Error('Failed to load categories');
        
        allCategoriesAndEvents = await response.json();
        
        selectEl.innerHTML = '<option value="">Enter Event Category</option>';
        
        allCategoriesAndEvents.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            selectEl.appendChild(option);
        });
        
        selectEl.disabled = false;
        eventSelectEl.disabled = true;

    } catch (error) {
        console.error(error);
        selectEl.innerHTML = '<option value="">Error loading</option>';
    }
}

async function loadTeams() {
    const selectEl = document.getElementById('filter-department');
    
    try {
        // We need auth to get the team list
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');

        const response = await fetch('/api/data?type=teams', {
             headers: { 'Authorization': `Bearer ${sessionData.session.access_token}` }
        });
        if (!response.ok) throw new Error('Failed to load teams');
        
        const teams = await response.json();
        
        selectEl.innerHTML = '<option value="">Enter Department</option>';
        
        teams.sort((a, b) => a.acronym.localeCompare(b.acronym));
        
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
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
        
        // Set title and fetch the CATEGORY TALLY
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
        let rank = 1;
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
            rank++;
        });

    } catch (error) {
        console.error('Error fetching category tally:', error);
        tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message error">${error.message}</td></tr>`;
    }
}

/**
 * Fetches and renders the rankings for a SPECIFIC EVENT.
 * (This is your old 'fetchAndDisplayRankings' function)
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
        // We need auth to get event-specific results
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');

        const response = await fetch(`/api/data?type=eventResults&eventId=${event.id}`, {
            headers: { 'Authorization': `Bearer ${sessionData.session.access_token}` }
        });
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