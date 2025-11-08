// This ONE file replaces session.js, logout.js, etc.
// for computation.html

// --- 0. GLOBAL VARIABLES ---------------------------
let allEventsData = []; // Caches all events from the API
let allTeamsData = [];  // Caches all teams from the API
let selectedEventId = null; // Stores the ID of the event we pick
let sortableInstance = null; // To hold the SortableJS object

// --- 1. AUTHENTICATION & SESSION -------------------
// ... (checkSession and signOut functions are here, no changes) ...
async function checkSession(authorizedRole) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
        window.location.replace("index.html");
        return;
    }

    const accessToken = sessionData.session.access_token;

    try {
        const response = await fetch('/api/login', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            await supabase.auth.signOut();
            window.location.replace("index.html");
            return;
        }

        const { role } = await response.json();

        if (role !== authorizedRole && role !== "admin") {
            console.log("Access Forbidden. Redirecting.");
            if (role === "tabHead") {
                window.location.replace("tabulation.html");
            } else {
                window.location.replace("index.html"); // Fallback
            }
        }
        console.log("Session valid, user authorized: " + role);

    } catch (error) {
        console.error('Error checking session:', error);
        window.location.replace("index.html");
    }
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error logging out:" + error.message);
    } else {
        console.log("Successfully logged out.");
        window.location.href = 'index.html';
    }
}


// --- 2. PAGE INITIALIZATION ------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // Run auth check first
    await checkSession("committee");

    // Fetch all events AND all teams
    await fetchAllEvents();
    await fetchAllTeams(); // <-- NEW

    // Attach listener to the logout button
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });

    // Attach listeners for our event search
    const searchInput = document.getElementById('eventSearch');
    const searchResults = document.getElementById('event-search-results');
    searchInput.addEventListener('input', (e) => renderDropdown(e.target.value.toLowerCase()));
    searchInput.addEventListener('focus', () => renderDropdown(searchInput.value.toLowerCase()));
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-events')) {
            searchResults.classList.add('hidden');
        }
    });

    // MODIFIED: Attach listener for the "Add Row" button
    document.getElementById('add-row-btn').addEventListener('click', addNewRankRow);

    // MODIFIED: Initialize the drag-and-drop functionality
    initSortable();

    // MODIFIED: Add listeners for the dynamic custom dropdowns
    const tabulationList = document.getElementById('tabulation-list');
    // This one click listener handles opening, selecting, AND deleting
    tabulationList.addEventListener('click', handleCustomSelectClick);

    // Create the first two rows automatically
    addNewRankRow();
    addNewRankRow();

    // Hide loader
    const loader = document.getElementById('loader');
    loader.classList.add('hide');
    setTimeout(() => { loader.style.display = 'none'; }, 600);
});

// --- 3. DYNAMIC DATA & SEARCH LOGIC --------------

async function fetchAllEvents() {
    try {
        const response = await fetch('/api/get-all-events');
        if (!response.ok) throw new Error('Failed to fetch events');
        const data = await response.json();
        allEventsData = data;
        console.log("Events loaded:", allEventsData);
    } catch (error) {
        console.error('Error loading all events:', error);
        const searchInput = document.getElementById('eventSearch');
        searchInput.value = 'Error loading events.';
        searchInput.disabled = true;
    }
}

async function fetchAllTeams() {
    try {
        const response = await fetch('/api/get-teams'); 
        if (!response.ok) throw new Error('Failed to fetch teams');
        
        const data = await response.json();
        allTeamsData = data; // Store in global cache
        console.log("Teams loaded:", allTeamsData);

        // Now that teams are loaded, update any existing rows
        document.querySelectorAll('.tab-row').forEach(row => {
            const list = row.querySelector('.custom-select-list');
            if (list) populateTeamList(list);
        });

    } catch (error) {
        console.error('Error loading all teams:', error);
    }
}

// ... (renderDropdown function is here, no changes) ...
function renderDropdown(query) {
    const resultsContainer = document.getElementById('event-search-results');
    resultsContainer.innerHTML = '';
    let hasMatches = false;

    allEventsData.forEach(category => {
        const matchingEvents = category.events.filter(event => 
            event.name.toLowerCase().includes(query)
        );

        if (matchingEvents.length > 0) {
            hasMatches = true;
            const categoryEl = document.createElement('div');
            categoryEl.className = 'search-results-category';
            categoryEl.textContent = category.name;
            resultsContainer.appendChild(categoryEl);
            
            matchingEvents.forEach(event => {
                const eventEl = document.createElement('div');
                eventEl.className = 'search-results-item';
                eventEl.textContent = event.name;
                eventEl.dataset.eventId = event.id;
                eventEl.dataset.eventName = event.name;
                eventEl.addEventListener('click', () => {
                    selectEvent(event.id, event.name);
                });
                resultsContainer.appendChild(eventEl);
            });
        }
    });

    if (!hasMatches) {
        const noResultsEl = document.createElement('div');
        noResultsEl.className = 'search-results-item';
        noResultsEl.textContent = 'No events found';
        resultsContainer.appendChild(noResultsEl);
    }
    resultsContainer.classList.remove('hidden');
}

function selectEvent(eventId, eventName) {
    console.log("Selected event:", eventName, eventId);
    document.getElementById('eventSearch').value = eventName;
    selectedEventId = eventId;
    document.getElementById('event-search-results').classList.add('hidden');
    // TODO: You might want to clear the ranking list when a new event is selected
    // e.g., document.getElementById('tabulation-list').innerHTML = '';
    // addNewRankRow();
    // addNewRankRow();
}


// --- 4. NEW RANKING LIST LOGIC -------------------

/**
 * Creates the HTML for a single new ranking row and appends it.
 */
function addNewRankRow() {
    const list = document.getElementById('tabulation-list');
    const newRank = list.children.length + 1;
    const newRow = createRankRow(newRank);
    list.appendChild(newRow);
}

/**
 * Helper function that builds the HTML for a new row.
 * MODIFIED: Now adds a delete button.
 */
function createRankRow(rankNumber) {
    const row = document.createElement('div');
    row.className = 'tab-row';
    row.dataset.teamId = "null"; // Store the selected team ID here

    // 1. Drag Handle
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '&#x2630;';
    
    // 2. Rank Number
    const num = document.createElement('div');
    num.className = 'tab-num';
    num.textContent = rankNumber;

    // 3. Custom Select Box (the visible part)
    const selectBox = document.createElement('div');
    selectBox.className = 'custom-select-box';
    selectBox.innerHTML = `<span class="placeholder">+ Select Team</span>`;
    
    // 4. Custom Select List (the hidden dropdown)
    const selectList = document.createElement('div');
    selectList.className = 'custom-select-list hidden';
    
    // 5. Fill the list with teams
    populateTeamList(selectList);

    // 6. NEW: Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button'; // Prevents form submission
    deleteBtn.className = 'delete-row-btn';
    deleteBtn.innerHTML = '&times;'; // "X" icon

    // Assemble the row
    row.appendChild(handle);
    row.appendChild(num);
    row.appendChild(selectBox);
    row.appendChild(deleteBtn); // NEW
    row.appendChild(selectList); // This must be last for CSS selector
    
    return row;
}

/**
 * Fills a dropdown list element with all loaded teams.
 * MODIFIED: No longer filters, just builds the list.
 */
function populateTeamList(listElement) {
    listElement.innerHTML = ''; // Clear it
    if (allTeamsData.length === 0) {
        listElement.innerHTML = '<div class="custom-select-item">Loading teams...</div>';
        return;
    }
    
    allTeamsData.forEach(team => {
        const item = document.createElement('div');
        item.className = 'custom-select-item';
        item.dataset.teamId = team.id;
        item.dataset.teamName = team.name;
        item.dataset.teamAcronym = team.acronym;
        item.dataset.teamLogo = team.logo_url;

        item.innerHTML = `
            <img src="${team.logo_url}" alt="${team.acronym} logo">
            <span class="acronym">${team.acronym}</span>
            <span class="name">${team.name}</span>
        `;
        listElement.appendChild(item);
    });
}

/**
 * NEW: Helper function to get all currently selected team IDs
 */
function getCurrentlySelectedTeamIds() {
    const selectedIds = new Set();
    document.querySelectorAll('.tab-row').forEach(row => {
        const id = row.dataset.teamId;
        if (id && id !== "null") {
            selectedIds.add(id);
        }
    });
    return selectedIds;
}

/**
 * MODIFIED: Handles all clicks on the tabulation list.
 * Now manages opening dropdowns, selecting teams, AND deleting rows.
 */
function handleCustomSelectClick(e) {
    const target = e.target;

    // --- NEW: Case 0: User clicked the Delete Button ---
    const deleteBtn = target.closest('.delete-row-btn');
    if (deleteBtn) {
        const row = deleteBtn.closest('.tab-row');
        row.remove(); // Remove the row
        renumberRows(); // Renumber all remaining rows
        return;
    }

    // --- Case 1: User clicked the main box to open/close the list ---
    const selectBox = target.closest('.custom-select-box');
    if (selectBox) {
        const row = selectBox.closest('.tab-row');
        const list = row.querySelector('.custom-select-list');

        // NEW: Filter the list *before* showing it
        const selectedIds = getCurrentlySelectedTeamIds();
        const currentRowTeamId = row.dataset.teamId;

        Array.from(list.children).forEach(item => {
            const itemTeamId = item.dataset.teamId;
            // Check if this team is selected in ANOTHER row
            if (selectedIds.has(itemTeamId) && itemTeamId !== currentRowTeamId) {
                item.classList.add('disabled');
            } else {
                item.classList.remove('disabled');
            }
        });

        // Now, toggle the list
        list.classList.toggle('hidden');
        return;
    }

    // --- Case 2: User clicked on a team in the list ---
    const selectItem = target.closest('.custom-select-item');
    if (selectItem) {
        // NEW: Check if this item is disabled
        if (selectItem.classList.contains('disabled')) {
            return; // Do nothing if it's disabled
        }
        
        const row = selectItem.closest('.tab-row');
        const box = row.querySelector('.custom-select-box');
        const list = row.querySelector('.custom-select-list');
        const teamData = selectItem.dataset;

        // Update the box's HTML to show the selected team
        box.innerHTML = `
            <span class="selected-team">
                <img src="${teamData.teamLogo}" alt="${teamData.teamAcronym} logo">
                <span classs="acronym">${teamData.teamAcronym}</span>
                <span class="name">${teamData.teamName}</span>
            </span>
        `;
        
        // Store the selected ID on the row
        row.dataset.teamId = teamData.teamId;
        
        // Close the list
        list.classList.add('hidden');
        return;
    }
}

/**
 * Initializes the SortableJS drag-and-drop functionality
 */
function initSortable() {
    const list = document.getElementById('tabulation-list');
    sortableInstance = new Sortable(list, {
        animation: 150,
        handle: '.drag-handle', // Only allow dragging from the handle
        ghostClass: 'sortable-ghost', // Class for the placeholder
        onEnd: renumberRows, // Call this function after a drag
    });
}

/**
 * Called by SortableJS after a drag or after deleting a row.
 * It re-numbers all the rows sequentially.
 */
function renumberRows() {
    const list = document.getElementById('tabulation-list');
    list.querySelectorAll('.tab-row').forEach((row, index) => {
        const numEl = row.querySelector('.tab-num');
        numEl.textContent = index + 1; // Update rank (1, 2, 3...)
    });
}