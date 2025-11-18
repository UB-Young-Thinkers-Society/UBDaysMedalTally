// --- 1. GLOBAL VARIABLES ---------------------------
let allCategoriesAndEvents = [];
let currentCategory = null;
let allTeamsData = []; // NEW: Cache for teams

// --- 2. PAGE INITIALIZATION ------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadTeams();
    updateTimestamp();

    // --- MODIFIED: (Request #1) Listeners for Searchable Dropdowns ---
    const categorySearch = document.getElementById('filter-category-search');
    const categoryList = document.getElementById('category-list');
    
    const eventSearch = document.getElementById('filter-event-search');
    const eventList = document.getElementById('event-list');

    // Toggle dropdowns on focus
    categorySearch.addEventListener('focus', () => toggleDropdown('category-list'));
    eventSearch.addEventListener('focus', () => toggleDropdown('event-list'));

    // Handle search/filter on input
    categorySearch.addEventListener('input', filterCategoryList);
    eventSearch.addEventListener('input', filterEventList);

    // Handle selection from list
    categoryList.addEventListener('click', handleCategorySelect);
    eventList.addEventListener('click', handleEventSelect);

    // --- Listeners for Department Dropdown (Unchanged) ---
    document.getElementById('filter-department').addEventListener('click', () => toggleDropdown('department-list'));
    document.getElementById('department-list').addEventListener('click', handleDeptSelect);
    
    // Close dropdowns if clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-wrapper')) {
            document.getElementById('department-list').classList.add('hidden');
            document.getElementById('category-list').classList.add('hidden');
            document.getElementById('event-list').classList.add('hidden');
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

/**
 * NEW: (Request #1) Helper to toggle dropdowns
 */
function toggleDropdown(listId) {
    const allLists = document.querySelectorAll('.custom-select-list');
    allLists.forEach(list => {
        if (list.id !== listId) {
            list.classList.add('hidden');
        }
    });
    // Toggle the target list
    document.getElementById(listId).classList.toggle('hidden');
}

/**
 * MODIFIED: (Request #1) Load categories into custom list
 */
async function loadCategories() {
    const listEl = document.getElementById('category-list');
    const searchInput = document.getElementById('filter-category-search');
    try {
        const response = await fetch('/api/data?type=allEvents'); 
        if (!response.ok) throw new Error('Failed to load categories');
        allCategoriesAndEvents = await response.json();
        
        listEl.innerHTML = ''; // Clear loading
        
        // Add a "placeholder" option
        const allOption = document.createElement('div');
        allOption.className = 'custom-select-item';
        allOption.dataset.categoryId = ""; // Empty value
        allOption.dataset.categoryName = "Enter Event Category"; // Placeholder text
        allOption.innerHTML = `<span class="name" style="color: #777;">Enter Event Category</span>`;
        listEl.appendChild(allOption);

        allCategoriesAndEvents.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'custom-select-item';
            item.dataset.categoryId = cat.id;
            item.dataset.categoryName = cat.name;
            item.innerHTML = `<span class="name">${cat.name}</span>`;
            listEl.appendChild(item);
        });
        searchInput.disabled = false;
        searchInput.placeholder = "Enter Event Category";
    } catch (error) {
        console.error(error);
        listEl.innerHTML = '<div class="custom-select-item">Error loading</div>';
        searchInput.placeholder = "Error loading";
    }
}

async function loadTeams() {
    // ... (This function is unchanged)
    const listEl = document.getElementById('department-list');
    const boxEl = document.getElementById('filter-department');
    try {
        const response = await fetch('/api/data?type=teams'); 
        if (!response.ok) throw new Error('Failed to load teams');
        allTeamsData = await response.json(); 
        listEl.innerHTML = ''; 
        allTeamsData.sort((a, b) => a.name.localeCompare(b.name));
        allTeamsData.forEach(team => {
            const item = document.createElement('div');
            item.className = 'custom-select-item';
            item.dataset.teamId = team.id;
            item.dataset.teamName = team.name;
            item.dataset.teamLogo = team.logo_url;
            item.innerHTML = `
                <img src="${team.logo_url}" alt="${team.name} Logo" onerror="this.src='img/Login-Logo.png';">
                <span class="name">${team.name}</span>
            `;
            listEl.appendChild(item);
        });
        if (boxEl) boxEl.disabled = false;
    } catch (error) {
        console.error(error);
        listEl.innerHTML = '<div class="custom-select-item">Error loading</div>';
    }
}

/**
 * NEW: (Request #1) Replaces old handleCategoryChange
 */
function handleCategorySelect(e) {
    const item = e.target.closest('.custom-select-item');
    if (!item) return;

    const { categoryId, categoryName } = item.dataset;
    
    const box = document.getElementById('filter-category-box');
    const searchInput = document.getElementById('filter-category-search');
    
    box.dataset.categoryId = categoryId;
    searchInput.value = categoryName;
    document.getElementById('category-list').classList.add('hidden');

    // Restore full list
    filterCategoryList({ target: { value: '' } });

    // Trigger the logic to update the next filter
    populateEventFilter(categoryId);
}

/**
 * NEW: (Request #1) Logic from old handleCategoryChange, now populates event list
 */
function populateEventFilter(categoryId) {
    currentCategory = null;
    const eventListEl = document.getElementById('event-list');
    const eventSearchInput = document.getElementById('filter-event-search');
    const titleEl = document.getElementById('details-title');
    const tableBodyEl = document.getElementById('category-rankings-body');

    // --- (FIX #2) ---
    // Reset department dropdown and show category view
    resetDeptDropdown();
    showView('category');
    // --- END FIX ---

    // Reset event filter
    eventListEl.innerHTML = '';
    eventSearchInput.value = ''; // Clear text
    eventSearchInput.placeholder = 'Enter Event';
    eventSearchInput.disabled = true;
    document.getElementById('filter-event-box').dataset.eventId = "null";

    titleEl.textContent = '';
    
    if (!categoryId) {
        tableBodyEl.innerHTML = '<tr><td colspan="5" class="details-message empty">Please select a category to see rankings.</td></tr>';
        toggleTableHeaders('tally'); 
        eventSearchInput.placeholder = 'Select Category First';
        return;
    }

    currentCategory = allCategoriesAndEvents.find(cat => cat.id.toString() === categoryId); 
    
    if (currentCategory) {
        // Add "All Events" option for the category
        const allEventsOption = document.createElement('div');
        allEventsOption.className = 'custom-select-item';
        allEventsOption.dataset.eventId = ""; // Empty value
        allEventsOption.dataset.eventName = `All ${currentCategory.name} Events`;
        allEventsOption.innerHTML = `<span class="name" style="font-weight: 700;">All ${currentCategory.name} Events</span>`;
        eventListEl.appendChild(allEventsOption);

        if (currentCategory.events.length > 0) {
            currentCategory.events.forEach(event => {
                const item = document.createElement('div');
                item.className = 'custom-select-item';
                item.dataset.eventId = event.id;
                item.dataset.eventName = event.name;

                // NEW: (Request) Add status badge
                let statusBadge = '';
                if (event.status) {
                    let statusClass = '';
                    let statusText = '';
                    if (event.status === 'ongoing' || event.status === 'for review' || event.status === 'approved') {
                        statusClass = 'ongoing';
                        statusText = 'Ongoing';
                    } else if (event.status === 'published') {
                        statusClass = 'published';
                        statusText = 'Published';
                    }
                    
                    if (statusText) {
                        statusBadge = `<span class="event-status-badge ${statusClass}">${statusText}</span>`;
                    }
                }
                
                // MODIFIED: (Request) Add badge to HTML
                item.innerHTML = `<span class="name">${event.name}</span> ${statusBadge}`;
                eventListEl.appendChild(item);
            });
            eventSearchInput.disabled = false;
        } else {
            eventListEl.innerHTML = '<div class="custom-select-item">No events found</div>';
            eventSearchInput.placeholder = 'No events found';
        }
        titleEl.textContent = currentCategory.name;
        fetchAndDisplayCategoryTally(currentCategory.id);
    }
}


// --- 4. CUSTOM DROPDOWN LOGIC ---------------

/**
 * NEW: (Request #1) Filter function for category list
 */
function filterCategoryList(e) {
    const filter = e.target.value.toLowerCase();
    const items = document.querySelectorAll('#category-list .custom-select-item');
    items.forEach(item => {
        const name = item.dataset.categoryName.toLowerCase();
        if (name.includes(filter)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * NEW: (Request #1) Filter function for event list
 */
function filterEventList(e) {
    const filter = e.target.value.toLowerCase();
    const items = document.querySelectorAll('#event-list .custom-select-item');
    items.forEach(item => {
        const name = item.dataset.eventName.toLowerCase();
        if (name.includes(filter)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}


function handleDeptSelect(e) {
    // ... (This function is unchanged)
    const item = e.target.closest('.custom-select-item');
    if (!item) return;

    const boxEl = document.getElementById('filter-department');
    const listEl = document.getElementById('department-list');
    const { teamId, teamName, teamLogo } = item.dataset;

    boxEl.dataset.teamId = teamId;
    boxEl.innerHTML = `
        <span class="selected-team">
            <img src="${teamLogo}" alt="${teamName} Logo" onerror="this.src='img/Login-Logo.png';">
            <span class="name">${teamName}</span>
        </span>
    `;
    listEl.classList.add('hidden'); 

    fetchAndDisplayDepartmentTally(teamId);
}

/**
 * NEW: (FIX #2) Helper function to reset the department dropdown
 */
function resetDeptDropdown() {
    // ... (This function is unchanged)
    const boxEl = document.getElementById('filter-department');
    if (boxEl) {
        boxEl.dataset.teamId = "null";
        boxEl.innerHTML = `<span class="placeholder">Enter Department</span>`;
    }
}

// --- 5. RANKING DISPLAY LOGIC ----------------------

function showView(viewType) {
    // ... (This function is unchanged)
    const categoryView = document.getElementById('category-details-view');
    const deptView = document.getElementById('department-details-view');
    if (viewType === 'department') {
        categoryView.style.display = 'none';
        deptView.style.display = 'block';
    } else { 
        categoryView.style.display = 'block';
        deptView.style.display = 'none';
    }
}

/**
 * NEW: (Request #1) Replaces old handleEventChange
 */
function handleEventSelect(e) {
    const item = e.target.closest('.custom-select-item');
    if (!item) return;

    const { eventId, eventName } = item.dataset;
    
    const box = document.getElementById('filter-event-box');
    const searchInput = document.getElementById('filter-event-search');
    
    box.dataset.eventId = eventId;
    searchInput.value = eventName;
    document.getElementById('event-list').classList.add('hidden');

    // Restore full list
    filterEventList({ target: { value: '' } });

    // --- Start logic from old handleEventChange ---
    const titleEl = document.getElementById('details-title');

    resetDeptDropdown();
    showView('category');

    if (!eventId) { // "All Events" selected
        if (currentCategory) {
            titleEl.textContent = currentCategory.name;
            fetchAndDisplayCategoryTally(currentCategory.id);
        }
        return;
    }
    let selectedEvent = null;
    if (currentCategory) {
        selectedEvent = currentCategory.events.find(ev => ev.id.toString() === eventId);
    }
    if (selectedEvent) {
        titleEl.textContent = `${currentCategory.name} - ${selectedEvent.name}`;
        fetchAndDisplayEventRankings(selectedEvent); // Call existing function
    }
    // --- End logic from old handleEventChange ---
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
    showView('category'); 
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
    showView('category');
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

// --- 6. DEPARTMENT TALLY LOGIC (Request #2 & #3) ---

async function fetchAndDisplayDepartmentTally(teamId) {
    // ... (This function is unchanged)
    showView('department'); 
    const view = document.getElementById('department-details-view');
    view.innerHTML = `<div class="details-message loading">Loading results for department...</div>`;
    try {
        const response = await fetch(`/api/data?type=departmentResults&teamId=${teamId}`);
        if (!response.ok) throw new Error('Failed to fetch department results.');
        const data = await response.json();
        const medalTallyHTML = `
            <span class="gold"><span class="medal-icon gold"></span> ${data.totals.totalGold}</span>
            <span class="silver"><span class="medal-icon silver"></span> ${data.totals.totalSilver}</span>
            <span class="bronze"><span class="medal-icon bronze"></span> ${data.totals.totalBronze}</span>
        `;
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
            <div class="table-scroll">
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
        const categoryNames = Object.keys(data.categories).sort();
        if (categoryNames.length === 0) {
            tableHTML += `<tr><td colspan="4" class="details-message empty" style="padding-top: 30px;">This department has no published results.</td></tr>`;
        }
        for (const categoryName of categoryNames) {
            tableHTML += `
                <tr class="category-header-row">
                    <td colspan="4" class="event-name" style="padding-top: 20px;"><strong>${categoryName}</strong></td>
                </tr>
            `;
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
        tableHTML += `</tbody></table></div>`;
        view.innerHTML = tableHTML;
    } catch (error) {
        console.error('Error fetching department tally:', error);
        view.innerHTML = `<div class="details-message error">${error.message}</div>`;
    }
}