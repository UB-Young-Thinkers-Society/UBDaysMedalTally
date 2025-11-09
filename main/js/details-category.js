// --- 1. GLOBAL VARIABLES ---------------------------
let allCategoriesAndEvents = [];
let currentCategory = null; // MODIFIED: Store the whole category object

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
        const response = await fetch('/api/data?type=allEvents'); 
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
        const response = await fetch('/api/data?type=teams'); 
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

function handleCategoryChange(e) {
    const categoryId = e.target.value;
    const eventSelectEl = document.getElementById('filter-event');
    const titleEl = document.getElementById('details-title');
    const tableBodyEl = document.getElementById('category-rankings-body');

    // Reset
    eventSelectEl.innerHTML = '<option value="">Enter Event</option>';
    eventSelectEl.disabled = true;
    titleEl.textContent = '';
    currentCategory = null; // MODIFIED
    
    if (!categoryId) {
        tableBodyEl.innerHTML = '<tr><td colspan="5" class="details-message empty">Please select a category to see rankings.</td></tr>'; // MODIFIED: colspan="5"
        toggleTableHeaders('tally'); // Show tally headers by default
        return;
    }

    currentCategory = allCategoriesAndEvents.find(cat => cat.id === categoryId); // MODIFIED
    
    if (currentCategory) {
        if (currentCategory.events.length > 0) {
            currentCategory.events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.id;
                option.textContent = event.name;
                eventSelectEl.appendChild(option);
            });
            eventSelectEl.disabled = false;
        } else {
            eventSelectEl.innerHTML = '<option value="">No events found</option>';
        }
        
        titleEl.textContent = currentCategory.name;
        fetchAndDisplayCategoryTally(currentCategory.id);
    }
}

// --- 4. RANKING DISPLAY LOGIC ----------------------

function handleEventChange(e) {
    const eventId = e.target.value;
    const titleEl = document.getElementById('details-title');

    if (!eventId) {
        // "Enter Event" was selected, revert to category tally
        if (currentCategory) {
            titleEl.textContent = currentCategory.name; // (Bug #3) Revert title
            fetchAndDisplayCategoryTally(currentCategory.id);
        }
        return;
    }

    let selectedEvent = null;
    if (currentCategory) {
        selectedEvent = currentCategory.events.find(ev => ev.id === eventId);
    }
    
    if (selectedEvent) {
        // (Bug #3) Update title to "Category - Event"
        titleEl.textContent = `${currentCategory.name} - ${selectedEvent.name}`;
        fetchAndDisplayEventRankings(selectedEvent);
    }
}

/**
 * NEW: Helper function to show/hide the correct table headers
 */
function toggleTableHeaders(mode) {
    const tallyHeaders = document.getElementById('tally-headers');
    const rankHeader = document.getElementById('rank-header');
    
    if (mode === 'tally') {
        tallyHeaders.style.display = 'table-row';
        rankHeader.style.display = 'none';
    } else { // mode === 'rank'
        tallyHeaders.style.display = 'none';
        rankHeader.style.display = 'table-row';
    }
}

/**
 * MODIFIED: (Bug #1) Fetches and renders the OVERALL TALLY for a category
 * in the 4-column format.
 */
async function fetchAndDisplayCategoryTally(categoryId) {
    toggleTableHeaders('tally'); // MODIFIED: Show tally headers
    const tableBodyEl = document.getElementById('category-rankings-body');
    tableBodyEl.innerHTML = `<tr><td colspan="5" class="details-message loading">Loading category tally...</td></tr>`; // MODIFIED: colspan="5"
    
    try {
        const response = await fetch(`/api/data?type=categoryTally&categoryId=${categoryId}`);
        if (!response.ok) throw new Error('Failed to fetch category tally.');

        const tally = await response.json();
        
        if (tally.length === 0) {
            tableBodyEl.innerHTML = `<tr><td colspan="5" class="details-message empty">No published results for this category yet.</td></tr>`; // MODIFIED: colspan="5"
            return;
        }

        tableBodyEl.innerHTML = ''; 
        
        tally.forEach(team => {
            const tr = document.createElement('tr');
            
            // MODIFIED: (Bug #1) Render 4 medal columns
            tr.innerHTML = `
                <td>
                    <img src="${team.logo_url}" class="dept-logo" alt="${team.acronym} Logo" onerror="this.src='img/Login-Logo.png';">
                    <span class="dept-name">${team.name}</span>
                </td>
                <td class="gold">${team.gold}</td>
                <td class="silver">${team.silver}</td>
                <td class="bronze">${team.bronze}</td>
                <td class="total">${team.total}</td>
            `;
            tableBodyEl.appendChild(tr);
        });

    } catch (error) {
        console.error('Error fetching category tally:', error);
        tableBodyEl.innerHTML = `<tr><td colspan="5" class="details-message error">${error.message}</td></tr>`; // MODIFIED: colspan="5"
    }
}

/**
 * Fetches and renders the rankings for a SPECIFIC EVENT.
 */
async function fetchAndDisplayEventRankings(event) {
    toggleTableHeaders('rank'); // MODIFIED: Show rank header
    const tableBodyEl = document.getElementById('category-rankings-body');
    tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message loading">Loading event rankings...</td></tr>`; // MODIFIED: colspan="2"
    
    if (event.status !== 'published') {
        tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message empty">Results for this event are not yet published. The status is: ${event.status}</td></tr>`; // MODIFIED: colspan="2"
        return;
    }

    try {
        const response = await fetch(`/api/data?type=eventResults&eventId=${event.id}`);
        if (!response.ok) throw new Error('Failed to fetch results.');

        const results = await response.json();
        
        if (results.length === 0) {
            tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message empty">This event is published, but no rankings were submitted.</td></tr>`; // MODIFIED: colspan="2"
            return;
        }

        renderRankingsTable(results, tableBodyEl);

    } catch (error) {
        console.error('Error fetching rankings:', error);
        tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message error">${error.message}</td></tr>`; // MODIFIED: colspan="2"
    }
}

/**
 * Helper function to build the HTML for the EVENT rankings table.
 */
function renderRankingsTable(results, tableBodyEl) {
    tableBodyEl.innerHTML = ''; 
    
    results.forEach(result => {
        const team = result.teams;
        const tr = document.createElement('tr');
        
        let rankDisplay = `${result.rank}th`;
        let rankClass = '';
        if (result.rank === 1) { rankDisplay = '1st'; rankClass = 'gold'; }
        if (result.rank === 2) { rankDisplay = '2nd'; rankClass = 'silver'; }
        if (result.rank === 3) { rankDisplay = '3rd'; rankClass = 'bronze'; }

        // MODIFIED: This now only renders 2 columns
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