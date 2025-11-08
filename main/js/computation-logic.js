// This ONE file replaces session.js, logout.js, etc.
// for computation.html

// --- 0. GLOBAL VARIABLES ---------------------------
let allEventsData = []; // Caches all events from the API
let allTeamsData = [];  // Caches all teams from the API
let selectedEvent = null; // Stores the entire selected event object
let sortableInstance = null; // To hold the SortableJS object

// --- 1. AUTHENTICATION & SESSION -------------------
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
            if (role === "tabHead") window.location.replace("tabulation.html");
            else window.location.replace("index.html");
        }
    } catch (error) {
        console.error('Error checking session:', error);
        window.location.replace("index.html");
    }
}
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error logging out:" + error.message);
    else window.location.href = 'index.html';
}


// --- 2. PAGE INITIALIZATION ------------------------
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession("committee");
    await fetchAllEvents();
    await fetchAllTeams(); 
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });
    const searchInput = document.getElementById('eventSearch');
    const searchResults = document.getElementById('event-search-results');
    searchInput.addEventListener('input', (e) => renderDropdown(e.target.value.toLowerCase()));
    searchInput.addEventListener('focus', () => renderDropdown(searchInput.value.toLowerCase()));
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-events')) {
            searchResults.classList.add('hidden');
        }
    });
    document.getElementById('add-row-btn').addEventListener('click', addNewRankRow);
    initSortable();
    const tabulationList = document.getElementById('tabulation-list');
    tabulationList.addEventListener('click', handleCustomSelectClick);
    document.querySelector('.tie-group').addEventListener('input', updateRanksAndVisuals);
    const computationForm = document.getElementById('computation-form');
    computationForm.addEventListener('submit', handleSubmit);
    addNewRankRow();
    addNewRankRow();
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hide');
        setTimeout(() => { loader.style.display = 'none'; }, 600);
    }
});

// --- 3. DYNAMIC DATA & SEARCH LOGIC --------------
async function fetchAllEvents() {
    try {
        const response = await fetch('/api/get-all-events');
        if (!response.ok) throw new Error('Failed to fetch events');
        const data = await response.json();
        allEventsData = data;
    } catch (error) {
        console.error('Error loading all events:', error);
        document.getElementById('eventSearch').value = 'Error loading events.';
        document.getElementById('eventSearch').disabled = true;
    }
}
async function fetchAllTeams() {
    try {
        const response = await fetch('/api/get-teams'); 
        if (!response.ok) throw new Error('Failed to fetch teams');
        const data = await response.json();
        allTeamsData = data; 
        document.querySelectorAll('.tab-row').forEach(row => {
            const list = row.querySelector('.custom-select-list');
            if (list) populateTeamList(list);
        });
    } catch (error) {
        console.error('Error loading all teams:', error);
    }
}
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
                const eventObject = event; 
                eventEl.addEventListener('click', () => {
                    selectEvent(eventObject);
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

function selectEvent(event) {
    console.log("Selected event:", event.name, event.id);
    document.getElementById('eventSearch').value = event.name;
    selectedEvent = event; // Store the whole event
    document.getElementById('event-search-results').classList.add('hidden');
    loadEventResults(event.id);
}

/**
 * MODIFIED: This function now reconstructs the tie-group string
 */
async function loadEventResults(eventId) {
    const list = document.getElementById('tabulation-list');
    const tieInput = document.querySelector('.tie-group');
    list.innerHTML = `<div class="loading-message">Loading results...</div>`;
    tieInput.value = ''; // Clear old tie string

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');
        const accessToken = sessionData.session.access_token;
        
        const response = await fetch(`/api/get-event-results?eventId=${eventId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error('Failed to fetch results.');
        
        const results = await response.json(); // Data is sorted by rank
        list.innerHTML = ''; 

        // --- NEW (THE BUG FIX) ---
        // Analyze the results to find and build the tie string
        const ranks = {}; // { 1: [pos1, pos2, pos3], 2: [pos4], 3: [pos5, pos6] }
        results.forEach((result, index) => {
            const rank = result.rank;
            const position = index + 1;
            if (!ranks[rank]) {
                ranks[rank] = [];
            }
            ranks[rank].push(position);
        });

        const tieStrings = [];
        for (const rankKey in ranks) {
            const positions = ranks[rankKey];
            if (positions.length > 1) {
                // Find consecutive positions
                const start = positions[0];
                const end = positions[positions.length - 1];
                if (end - start === positions.length - 1) {
                    tieStrings.push(`${start}-${end}`);
                }
            }
        }
        
        // Set the tie input's value
        tieInput.value = tieStrings.join(', ');
        // --- END OF NEW BLOCK ---


        if (results.length > 0) {
            // This event HAS saved results. Re-build the list.
            results.forEach(result => {
                const teamData = result.teams;
                const row = createRankRow(result.rank);
                const box = row.querySelector('.custom-select-box');
                box.innerHTML = `
                    <span class="selected-team">
                        <img src="${teamData.logo_url}" alt="${teamData.acronym} logo" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid #eee;">
                        <span class="acronym">${teamData.acronym}</span>
                        <span class="name">${teamData.name}</span>
                    </span>
                `;
                row.dataset.teamId = teamData.id;
                list.appendChild(row);
            });
        } else {
            // This event has NO saved results. Create two blank rows.
            addNewRankRow();
            addNewRankRow();
        }

        // Finally, apply all colors and tie visuals
        // This will now read the pre-filled tie box and work correctly
        updateRanksAndVisuals();

    } catch (error) {
        console.error('Error loading event results:', error);
        list.innerHTML = `<div class="loading-message error">Error: ${error.message}</div>`;
    }
}


// --- 4. RANKING LIST LOGIC -------------------
// ... (addNewRankRow, createRankRow, populateTeamList... all unchanged) ...
function addNewRankRow() {
    const list = document.getElementById('tabulation-list');
    const newRank = list.children.length + 1;
    const newRow = createRankRow(newRank);
    list.appendChild(newRow);
    updateRanksAndVisuals();
}
function createRankRow(rankNumber) {
    const row = document.createElement('div');
    row.className = 'tab-row';
    row.dataset.teamId = "null"; 
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '&#x2630;';
    const num = document.createElement('div');
    num.className = 'tab-num';
    num.textContent = rankNumber;
    const selectBox = document.createElement('div');
    selectBox.className = 'custom-select-box';
    selectBox.innerHTML = `<span class="placeholder">+ Select Team</span>`;
    const selectList = document.createElement('div');
    selectList.className = 'custom-select-list hidden';
    populateTeamList(selectList);
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button'; 
    deleteBtn.className = 'delete-row-btn';
    deleteBtn.innerHTML = '&times;'; 
    row.appendChild(handle);
    row.appendChild(num);
    row.appendChild(selectBox);
    row.appendChild(deleteBtn);
    row.appendChild(selectList);
    return row;
}
function populateTeamList(listElement) {
    listElement.innerHTML = ''; 
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


// ... (getCurrentlySelectedTeamIds, handleCustomSelectClick, initSortable, parseTieGroups, updateRanksAndVisuals... all unchanged) ...
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
function handleCustomSelectClick(e) {
    const target = e.target;
    const deleteBtn = target.closest('.delete-row-btn');
    if (deleteBtn) {
        const row = deleteBtn.closest('.tab-row');
        row.remove(); 
        updateRanksAndVisuals(); 
        return;
    }
    const selectBox = target.closest('.custom-select-box');
    if (selectBox) {
        const row = selectBox.closest('.tab-row');
        const list = row.querySelector('.custom-select-list');
        const selectedIds = getCurrentlySelectedTeamIds();
        const currentRowTeamId = row.dataset.teamId;
        Array.from(list.children).forEach(item => {
            const itemTeamId = item.dataset.teamId;
            if (selectedIds.has(itemTeamId) && itemTeamId !== currentRowTeamId) {
                item.classList.add('disabled');
            } else {
                item.classList.remove('disabled');
            }
        });
        list.classList.toggle('hidden');
        return;
    }
    const selectItem = target.closest('.custom-select-item');
    if (selectItem) {
        if (selectItem.classList.contains('disabled')) {
            return; 
        }
        const row = selectItem.closest('.tab-row');
        const box = row.querySelector('.custom-select-box');
        const list = row.querySelector('.custom-select-list');
        const teamData = selectItem.dataset;
        box.innerHTML = `
            <span class="selected-team">
                <img src="${teamData.teamLogo}" alt="${teamData.teamAcronym} logo" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid #eee;">
                <span class="acronym">${teamData.teamAcronym}</span>
                <span class="name">${teamData.teamName}</span>
            </span>
        `;
        row.dataset.teamId = teamData.teamId;
        list.classList.add('hidden');
        return;
    }
}
function initSortable() {
    const list = document.getElementById('tabulation-list');
    sortableInstance = new Sortable(list, {
        animation: 150,
        handle: '.drag-handle', 
        ghostClass: 'sortable-ghost', 
        onEnd: updateRanksAndVisuals, 
    });
}
function parseTieGroups() {
    const input = document.querySelector('.tie-group').value;
    const groups = [];
    const matches = input.matchAll(/(\d+)\s*-\s*(\d+)/g);
    for (const match of matches) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        if (start < end) {
            groups.push([start, end]);
        }
    }
    return groups;
}
function updateRanksAndVisuals() {
    const list = document.getElementById('tabulation-list');
    const rows = Array.from(list.children);
    const tieGroups = parseTieGroups(); 
    const positionToRank = {}; 
    let currentRank = 1;
    let position = 1;
    while (position <= rows.length) {
        const tie = tieGroups.find(group => group[0] === position);
        if (tie) {
            const [start, end] = tie;
            for (let i = start; i <= end; i++) {
                if (i <= rows.length) {
                    positionToRank[i] = currentRank;
                }
            }
            position = end + 1; 
        } else {
            positionToRank[position] = currentRank;
            position++;
        }
        currentRank++;
    }
    rows.forEach((row, index) => {
        const pos = index + 1; 
        const finalRank = positionToRank[pos];
        const numEl = row.querySelector('.tab-num');
        numEl.classList.remove('rank-1', 'rank-2', 'rank-3');
        row.classList.remove('tie-start', 'tie-middle', 'tie-end');
        if (finalRank) {
            numEl.textContent = finalRank;
            if (finalRank <= 3) {
                numEl.classList.add(`rank-${finalRank}`);
            }
        } else {
            numEl.textContent = pos; 
        }
    });
    tieGroups.forEach(group => {
        const [start, end] = group;
        for (let i = start; i <= end; i++) {
            if (i > rows.length) break; 
            const row = rows[i - 1]; 
            if (i === start) {
                row.classList.add('tie-start');
            } else if (i === end) {
                row.classList.add('tie-end');
            } else {
                row.classList.add('tie-middle');
            }
        }
    });
    return positionToRank;
}

// ... (handleSubmit is unchanged) ...
async function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    try {
        if (!selectedEvent) {
            throw new Error('Please select an event from the search box.');
        }
        const rows = document.querySelectorAll('#tabulation-list .tab-row');
        if (rows.length === 0) {
            throw new Error('Please add at least one team to the ranking.');
        }
        const hasUnselected = Array.from(rows).some(row => row.dataset.teamId === "null");
        if (hasUnselected) {
            throw new Error('Please select a team for every ranking row.');
        }
        const rankMap = updateRanksAndVisuals();
        const medalValue = selectedEvent.medal_value;
        const resultsToSubmit = [];
        rows.forEach((row, index) => {
            const position = index + 1; 
            const teamId = row.dataset.teamId;
            const finalRank = rankMap[position] || position; 
            let gold = 0, silver = 0, bronze = 0;
            if (finalRank === 1) {
                gold = medalValue;
            } else if (finalRank === 2) {
                silver = medalValue;
            } else if (finalRank === 3) {
                bronze = medalValue;
            }
            resultsToSubmit.push({
                team_id: teamId,
                rank: finalRank,
                gold_awarded: gold,
                silver_awarded: silver,
                bronze_awarded: bronze
            });
        });
        
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            throw new Error('Your session has expired. Please log in again.');
        }
        const accessToken = sessionData.session.access_token;

        const payload = {
            eventId: selectedEvent.id,
            results: resultsToSubmit
        };
        
        const response = await fetch('/api/submit-results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}` 
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Server failed to submit results.');
        }
        alert('Results submitted successfully for review!');
        
        document.getElementById('eventSearch').value = '';
        selectedEvent = null;
        document.querySelector('.tie-group').value = '';
        document.getElementById('tabulation-list').innerHTML = '';
        addNewRankRow();
        addNewRankRow();
        updateRanksAndVisuals();
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
}