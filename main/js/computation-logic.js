// This ONE file replaces session.js, logout.js, etc.
// for computation.html

// --- 0. GLOBAL VARIABLES ---------------------------
let allEventsData = []; // Caches all events from the API
let selectedEventId = null; // Stores the ID of the event we pick

// --- 1. AUTHENTICATION & SESSION -------------------

/**
 * Securely checks the user's session and role.
 * This is the same logic from the login fix.
 */
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
        // If we are here, user is authorized.
        console.log("Session valid, user authorized: " + role);

    } catch (error) {
        console.error('Error checking session:', error);
        window.location.replace("index.html");
    }
}

/**
 * Logs the user out and returns to index.html
 */
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

    // Fetch all events and store them in our global variable
    await fetchAllEvents();

    // Attach listener to the logout button
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });

    // Attach listeners for our new search
    const searchInput = document.getElementById('eventSearch');
    const searchResults = document.getElementById('event-search-results');

    // Main listener: Filter as the user types
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        renderDropdown(query);
    });

    // Show dropdown when input is clicked
    searchInput.addEventListener('focus', () => {
        renderDropdown(searchInput.value.toLowerCase());
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-events')) {
            searchResults.classList.add('hidden');
        }
    });

    // Hide loader
    // const loader = document.getElementById('loader');
    // loader.classList.add('hide');
    // setTimeout(() => { loader.style.display = 'none'; }, 600);
});

// --- 3. DYNAMIC DATA & SEARCH LOGIC --------------

/**
 * Fetches all events (grouped by category) from our secure API
 * and stores them in the 'allEventsData' variable.
 */
async function fetchAllEvents() {
    try {
        // We use the same API as the tabulation page
        const response = await fetch('/api/get-all-events');
        if (!response.ok) throw new Error('Failed to fetch events');
        
        const data = await response.json();
        allEventsData = data; // Store in global cache
        console.log("Events loaded:", allEventsData);

    } catch (error) {
        console.error('Error loading all events:', error);
        // Show an error where the search box is
        const searchInput = document.getElementById('eventSearch');
        searchInput.value = 'Error loading events.';
        searchInput.disabled = true;
    }
}

/**
 * Filters the cached 'allEventsData' based on a search query
 * and renders the dropdown UI.
 */
function renderDropdown(query) {
    const resultsContainer = document.getElementById('event-search-results');
    resultsContainer.innerHTML = ''; // Clear old results

    let hasMatches = false;

    // Loop through each CATEGORY
    allEventsData.forEach(category => {
        // Find events in this category that match the query
        const matchingEvents = category.events.filter(event => 
            event.name.toLowerCase().includes(query)
        );

        // If we have matches, render them
        if (matchingEvents.length > 0) {
            hasMatches = true;
            
            // 1. Add the bold category header
            const categoryEl = document.createElement('div');
            categoryEl.className = 'search-results-category';
            categoryEl.textContent = category.name;
            resultsContainer.appendChild(categoryEl);
            
            // 2. Add each matching event
            matchingEvents.forEach(event => {
                const eventEl = document.createElement('div');
                eventEl.className = 'search-results-item';
                eventEl.textContent = event.name;
                eventEl.dataset.eventId = event.id; // Store ID
                eventEl.dataset.eventName = event.name; // Store name

                // Add click listener to select the event
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

/**
 * Called when a user clicks an event in the dropdown.
 */
function selectEvent(eventId, eventName) {
    console.log("Selected event:", eventName, eventId);
    
    // Set the input text
    document.getElementById('eventSearch').value = eventName;

    // Store the selected ID
    selectedEventId = eventId;
    
    // Hide the dropdown
    document.getElementById('event-search-results').classList.add('hidden');

    // --- (FUTURE) ---
    // This is where you would trigger the next step,
    // like loading the teams into the ranking dropdowns.
    // e.g., loadTeamsForRanking();
}