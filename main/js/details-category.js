// --- 1. GLOBAL VARIABLES ---------------------------
let allCategoriesAndEvents = [];
let currentCategory = null;
let allTeamsData = []; // NEW: Cache for teams

// --- 2. PAGE INITIALIZATION ------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadTeams();
    updateTimestamp();

    document.getElementById('filter-category').addEventListener('change', handleCategoryChange);
    document.getElementById('filter-event').addEventListener('change', handleEventChange);

    // NEW: Listeners for the custom department dropdown
    document.getElementById('filter-department').addEventListener('click', toggleDeptDropdown);
    document.getElementById('department-list').addEventListener('click', handleDeptSelect);
    
    // Close dropdown if clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-wrapper')) {
            document.getElementById('department-list').classList.add('hidden');
        }
    });
});

function updateTimestamp() {
    // ... (This function is unchanged)
    const subtitle = document.getElementById('last-updated');
    if (!subtitle) return;
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    subtitle.textContent = `As of ${now.toLocaleDateString('en-US', options)}`;
}

// --- 3. DROPDOWN POPULATION FUNCTIONS --------------

async function loadCategories() {
    // ... (This function is unchanged)
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

/**
 * MODIFIED: (Request #1) Fetches all teams and populates the NEW
 * custom dropdown list.
 */
async function loadTeams() {
    const listEl = document.getElementById('department-list');
    const boxEl = document.getElementById('filter-department');
    
    try {
        const response = await fetch('/api/data?type=teams'); 
        if (!response.ok) throw new Error('Failed to load teams');
        
        allTeamsData = await response.json(); // Save to cache
        
        listEl.innerHTML = ''; // Clear "Loading..."
        
        allTeamsData.sort((a, b) => a.name.localeCompare(b.name));
        
        allTeamsData.forEach(team => {
            const item = document.createElement('div');
            item.className = 'custom-select-item';
            item.dataset.teamId = team.id;
            // Store all data on the element
            item.dataset.teamName = team.name;
            item.dataset.teamLogo = team.logo_url;
            
            // (Request #1) Show logo and full name
            item.innerHTML = `
                <img src="${team.logo_url}" alt="${team.name} Logo" onerror="this.src='img/Login-Logo.png';">
                <span class="name">${team.name}</span>
            `;
            listEl.appendChild(item);
        });
        boxEl.disabled = false;

    } catch (error) {
        console.error(error);
        listEl.innerHTML = '<div class="custom-select-item">Error loading</div>';
    }
}

function handleCategoryChange(e) {
    // ... (This function is unchanged)
    currentCategory = null;
    const categoryId = e.target.value;
    const eventSelectEl = document.getElementById('filter-event');
    const titleEl = document.getElementById('details-title');
    const tableBodyEl = document.getElementById('category-rankings-body');

    eventSelectEl.innerHTML = '<option value="">Enter Event</option>';
    eventSelectEl.disabled = true;
    titleEl.textContent = '';
    
    if (!categoryId) {
        tableBodyEl.innerHTML = '<tr><td colspan="5" class="details-message empty">Please select a category to see rankings.</td></tr>';
        toggleTableHeaders('tally'); 
        showView('category'); // NEW: Show category view
        return;
    }

    currentCategory = allCategoriesAndEvents.find(cat => cat.id === categoryId); 
    
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

// --- 4. NEW: CUSTOM DROPDOWN LOGIC ---------------

function toggleDeptDropdown() {
    document.getElementById('department-list').classList.toggle('hidden');
}

function handleDeptSelect(e) {
    const item = e.target.closest('.custom-select-item');
    if (!item) return;

    const boxEl = document.getElementById('filter-department');
    const listEl = document.getElementById('department-list');
    const { teamId, teamName, teamLogo } = item.dataset;

    // Update the selected box
    boxEl.dataset.teamId = teamId;
    boxEl.innerHTML = `
        <span class="selected-team">
            <img src="${teamLogo}" alt="${teamName} Logo" onerror="this.src='img/Login-Logo.png';">
            <span class="name">${teamName}</span>
        </span>
    `;
    listEl.classList.add('hidden'); // Close dropdown

    // --- (Request #2) ---
    // A team was selected, fetch and display its results
    fetchAndDisplayDepartmentTally(teamId);
}

// --- 5. RANKING DISPLAY LOGIC ----------------------

// NEW: Helper to switch between the two views
function showView(viewType) {
    const categoryView = document.getElementById('category-details-view');
    const deptView = document.getElementById('department-details-view');

    if (viewType === 'department') {
        categoryView.style.display = 'none';
        deptView.style.display = 'block';
    } else { // 'category'
        categoryView.style.display = 'block';
        deptView.style.display = 'none';
    }
}

function handleEventChange(e) {
    // ... (This function is unchanged, but we add one line)
    const eventId = e.target.value;
    const titleEl = document.getElementById('details-title');

    showView('category'); // NEW: Ensure category view is visible

    if (!eventId) {
        if (currentCategory) {
            titleEl.textContent = currentCategory.name;
            fetchAndDisplayCategoryTally(currentCategory.id);
        }
        return;
    }
    let selectedEvent = null;
    if (currentCategory) {
        selectedEvent = currentCategory.events.find(ev => ev.id === eventId);
    }
    if (selectedEvent) {
        titleEl.textContent = `${currentCategory.name} - ${selectedEvent.name}`;
        fetchAndDisplayEventRankings(selectedEvent);
    }
}

function toggleTableHeaders(mode) {
    // ... (This function is unchanged)
    const tallyHeaders = document.getElementById('tally-headers');
    const rankHeader = document.getElementById('rank-header');
    if (mode === 'tally') {
        tallyHeaders.style.display = 'table-row';
        rankHeader.style.display = 'none';
    } else { 
        tallyHeaders.style.display = 'none';
        rankHeader.style.display = 'table-row';
    }
}

async function fetchAndDisplayCategoryTally(categoryId) {
    // ... (This function is unchanged)
    showView('category'); // NEW: Ensure category view is visible
    toggleTableHeaders('tally'); 
    const tableBodyEl = document.getElementById('category-rankings-body');
    tableBodyEl.innerHTML = `<tr><td colspan="5" class="details-message loading">Loading category tally...</td></tr>`; 
    try {
        const response = await fetch(`/api/data?type=categoryTally&categoryId=${categoryId}`);
        if (!response.ok) throw new Error('Failed to fetch category tally.');
        const tally = await response.json();
        if (tally.length === 0) {
            tableBodyEl.innerHTML = `<tr><td colspan="5" class="details-message empty">No published results for this category yet.</td></tr>`;
            return;
        }
        tableBodyEl.innerHTML = ''; 
        tally.forEach(team => {
            const tr = document.createElement('tr');
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
        tableBodyEl.innerHTML = `<tr><td colspan="5" class="details-message error">${error.message}</td></tr>`;
    }
}

async function fetchAndDisplayEventRankings(event) {
    // ... (This function is unchanged)
    showView('category'); // NEW: Ensure category view is visible
    toggleTableHeaders('rank'); 
    const tableBodyEl = document.getElementById('category-rankings-body');
    tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message loading">Loading event rankings...</td></tr>`; 
    if (event.status !== 'published') {
        tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message empty">Results for this event are not yet published. The status is: ${event.status}</td></tr>`;
        return;
    }
    try {
        const response = await fetch(`/api/data?type=eventResults&eventId=${event.id}`);
        if (!response.ok) throw new Error('Failed to fetch results.');
        const results = await response.json();
        if (results.length === 0) {
            tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message empty">This event is published, but no rankings were submitted.</td></tr>`;
            return;
        }
        renderRankingsTable(results, tableBodyEl);
    } catch (error) {
        console.error('Error fetching rankings:', error);
        tableBodyEl.innerHTML = `<tr><td colspan="2" class="details-message error">${error.message}</td></tr>`;
    }
}

function renderRankingsTable(results, tableBodyEl) {
    // ... (This function is unchanged)
    tableBodyEl.innerHTML = ''; 
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

// --- 6. NEW: DEPARTMENT TALLY LOGIC (Request #2 & #3) ---

/**
 * NEW: Fetches and renders the results for a single department.
 */
async function fetchAndDisplayDepartmentTally(teamId) {
    showView('department'); // Show the department view
    const view = document.getElementById('department-details-view');
    view.innerHTML = `<div class="details-message loading">Loading results for department...</div>`;

    try {
        const response = await fetch(`/api/data?type=departmentResults&teamId=${teamId}`);
        if (!response.ok) throw new Error('Failed to fetch department results.');

        const data = await response.json();
        
        // (Request #3) Build the medal tally icons
        const medalTallyHTML = `
            <span class="gold"><span class="medal-icon gold"></span> ${data.totals.totalGold}</span>
            <span class="silver"><span class="medal-icon silver"></span> ${data.totals.totalSilver}</span>
            <span class="bronze"><span class="medal-icon bronze"></span> ${data.totals.totalBronze}</span>
        `;
        
        // Build the main table HTML
        let tableHTML = `
            <div class="department-header">
                <div class="department-title">
                    <img src="${data.teamInfo.logo_url}" alt="${data.teamInfo.name} Logo" onerror="this.src='img/Login-Logo.png';">
                    <h2>${data.teamInfo.name}</h2>
                </div>
                <div class="department-medal-tally">
                    ${medalTallyHTML}
                </div>
            </div>
            
            <table class="department-events-table">
                <thead>
                    <tr>
                        <th>Event Name</th>
                        <th class="gold">Gold</th>
                        <th class="silver">Silver</th>
                        <th class="bronze">Bronze</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Loop over the categories and events
        const categoryNames = Object.keys(data.categories).sort();
        if (categoryNames.length === 0) {
            tableHTML += `<tr><td colspan="4" class="details-message empty" style="padding-top: 30px;">This department has no published results.</td></tr>`;
        }
        
        for (const categoryName of categoryNames) {
            // Add a bold category header row
            tableHTML += `
                <tr class="category-header-row">
                    <td colspan="4" class="event-name" style="padding-top: 20px;"><strong>${categoryName}</strong></td>
                </tr>
            `;
            
            // Add a row for each event in that category
            data.categories[categoryName].forEach(event => {
                tableHTML += `
                    <tr>
                        <td class="sub-event">${event.event_name}</td>
                        <td class="gold">${event.gold > 0 ? event.gold : ''}</td>
                        <td class="silver">${event.silver > 0 ? event.silver : ''}</td>
                        <td class="bronze">${event.bronze > 0 ? event.bronze : ''}</td>
                    </tr>
                `;
            });
        }
        
        tableHTML += `</tbody></table>`;
        view.innerHTML = tableHTML;

    } catch (error) {
        console.error('Error fetching department tally:', error);
        view.innerHTML = `<div class="details-message error">${error.message}</div>`;
    }
}