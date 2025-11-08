// --- 1. AUTHENTICATION & SESSION -------------------

/**
 * Securely checks the user's session and role.
 */
async function checkSession(authorizedRole) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
        window.location.replace("index.html");
        return;
    }

    const accessToken = sessionData.session.access_token;

    try {
        const response = await fetch('/api/login', { // Use the same secure API
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
            if (role === "committee") {
                window.location.replace("computation.html");
            } else {
                window.location.replace("index.html"); // Fallback
            }
        }
        
        console.log("Session valid, user authorized.");

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
    await checkSession("tabHead");
    await loadAllEvents();

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });

    const loader = document.getElementById('loader');
    loader.classList.add('hide');
    setTimeout(() => { loader.style.display = 'none'; }, 600);
});

// --- 3. DYNAMIC DATA LOADING ---------------------

/**
 * Fetches all events, grouped by category, from our new secure API
 * and then calls render functions to build the page.
 */
async function loadAllEvents() {
    try {
        const response = await fetch('/api/get-all-events');
        if (!response.ok) throw new Error('Failed to fetch events');
        
        const categories = await response.json();
        
        const container = document.getElementById('categories-container');
        container.innerHTML = ''; 

        if (categories.length === 0) {
            container.innerHTML = '<p>No event categories found. Go to the Config page to add some.</p>';
            return;
        }

        for (const category of categories) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            categoryDiv.dataset.details = `category-${category.id}-details`;
            
            const ongoing = category.events.filter(e => e.status === 'ongoing').length;
            const submitted = category.events.filter(e => e.status === 'for review').length;
            const published = category.events.filter(e => e.status === 'published').length;

            categoryDiv.innerHTML = `
                <div class="cat-title">${category.name}</div>
                <div class="cat-status">${ongoing} ongoing &nbsp;|&nbsp; ${submitted} Submitted &nbsp;|&nbsp; ${published} Published</div>
                <div class="cat-arrow" id="arrow">&#9662;</div>
            `;
            
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'category-details';
            detailsDiv.id = `category-${category.id}-details`;
            detailsDiv.style.display = 'none';
            detailsDiv.innerHTML = `
                <table class="events-table">
                    <thead>
                        <tr>
                            <th>Event Name</th>
                            <th>Medal Count</th>
                            <th>Status</th>
                            <th>Actions</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Event rows will be built here -->
                    </tbody>
                </table>
            `;

            const tbody = detailsDiv.querySelector('tbody');
            if (category.events.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No events found in this category.</td></tr>`;
            } else {
                category.events.forEach(event => {
                    tbody.appendChild(createEventRow(event));
                });
            }

            container.appendChild(categoryDiv);
            container.appendChild(detailsDiv);

            categoryDiv.addEventListener('click', () => {
                toggleAccordion(categoryDiv, detailsDiv);
            });
        }

    } catch (error) {
        console.error('Error loading all events:', error);
        document.getElementById('categories-container').innerHTML = '<p>Error loading events.</p>';
    }
}

/**
 * MODIFIED: This function no longer builds the "Edit" button.
 */
function createEventRow(event) {
    const tr = document.createElement('tr');
    tr.dataset.eventId = event.id; 
    tr.dataset.eventName = event.name; // Store event name for the modal

    const eventName = event.name || "Unnamed Event";
    const medalCount = event.medal_value ?? "0"; 
    const statusText = event.status || "N/A";
    const statusClass = event.status ? event.status.replace(' ', '-').toLowerCase() : "none";

    // (1) Removed the "Edit" button from this template
    tr.innerHTML = `
        <td>${eventName}</td>
        <td>${medalCount}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td>
          <button class="filter review" data-status="for review" ${event.status === 'for review' ? 'disabled' : ''}>For Review</button>
          <button class="filter approved" data-status="approved" ${event.status === 'approved' ? 'disabled' : ''}>Approved</button>
          <button class="filter published" data-status="published" ${event.status === 'published' ? 'disabled' : ''}>Published</button>
          <button class="filter locked" data-status="locked" ${event.status === 'locked' ? 'disabled' : ''}>Locked</button>
        </td>
        <td>
          <button class="delete-btn" data-id="${event.id}">Delete</button>
        </td>
    `;

    tr.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteEvent(event.id, event.name, tr);
    });

    tr.querySelectorAll('.filter').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const newStatus = e.target.dataset.status;
            // (3) Pass eventName to the handler
            handleStatusUpdate(event.id, event.name, newStatus, tr);
        });
    });

    return tr;
}

/**
 * Handles the accordion open/close logic.
 */
function toggleAccordion(catDiv, detailsDiv) {
    var arrow = catDiv.querySelector('#arrow');
    if (!detailsDiv) return;

    if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
        detailsDiv.style.display = 'block';
        detailsDiv.style.opacity = 0;
        detailsDiv.style.transition = 'opacity 0.2s';
        setTimeout(() => { detailsDiv.style.opacity = 1; }, 10);
        arrow.style.transition = 'transform 0.2s';
        arrow.style.transform = 'rotate(180deg)';
    } else {
        detailsDiv.style.opacity = 0;
        detailsDiv.style.transition = 'opacity 0.2s';
        setTimeout(() => { detailsDiv.style.display = 'none'; }, 300);
        arrow.style.transition = 'transform 0.2s';
        arrow.style.transform = 'rotate(0deg)';
    }
}

// --- 4. API CALL HANDLERS (MODIFIED) -------------------

/**
 * MODIFIED: Now checks for "approved" status to show the modal.
 */
async function handleStatusUpdate(eventId, eventName, newStatus, tableRow) {
    // (3) NEW: If "approved" is clicked, show modal instead of calling API
    if (newStatus === 'approved') {
        showApprovalModal(eventId, eventName, tableRow);
        return; // Stop here
    }

    // (3) If "for review" is clicked, it can only be done if status is 'ongoing'
    const currentStatus = tableRow.querySelector('.status').textContent.toLowerCase();
    if (newStatus === 'for review' && currentStatus !== 'ongoing') {
        alert('You can only set an event to "For Review" from "Ongoing".');
        return;
    }

    // For "published" and "locked", proceed directly
    await updateEventStatusInDB(eventId, newStatus, tableRow);
}

/**
 * NEW: This function *only* calls the API.
 * It's now called by handleStatusUpdate OR the modal's confirm button.
 */
async function updateEventStatusInDB(eventId, newStatus, tableRow) {
    try {
        const response = await fetch('/api/update-event-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, newStatus })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update status');
        }

        // Update the UI
        const newStatusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        tableRow.querySelector('.status').textContent = newStatusText;
        tableRow.querySelector('.status').className = `status ${newStatus.replace(' ', '-').toLowerCase()}`;
        
        // (2) This logic now highlights the active button
        tableRow.querySelectorAll('.filter').forEach(btn => btn.disabled = false);
        tableRow.querySelector(`.filter[data-status="${newStatus}"]`).disabled = true;

        // Update the category header count
        const detailsDiv = tableRow.closest('.category-details');
        if (detailsDiv) {
            updateCategoryHeader(detailsDiv);
        }

    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error: ' + error.message);
    }
}

async function handleDeleteEvent(eventId, eventName, tableRow) {
    // ... (This function is unchanged) ...
    if (!confirm(`Are you sure you want to delete the event: "${eventName}"?`)) {
        return;
    }
    try {
        const response = await fetch('/api/delete-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete event');
        }
        tableRow.style.opacity = 0;
        tableRow.style.transition = 'opacity 0.3s';
        setTimeout(() => { tableRow.remove(); }, 300);
    } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error: ' + error.message);
    }
}

function updateCategoryHeader(detailsDiv) {
    // ... (This function is unchanged) ...
    try {
        const categoryDiv = detailsDiv.previousElementSibling;
        if (!categoryDiv) return;
        const statusDisplay = categoryDiv.querySelector('.cat-status');
        const allRows = detailsDiv.querySelectorAll('tbody tr');
        let ongoing = 0, submitted = 0, published = 0;
        allRows.forEach(row => {
            const statusSpan = row.querySelector('.status');
            if (!statusSpan) return; 
            const status = statusSpan.textContent.toLowerCase();
            if (status === 'ongoing') ongoing++;
            else if (status === 'for review') submitted++;
            else if (status === 'published') published++;
        });
        statusDisplay.textContent = `${ongoing} ongoing  |  ${submitted} Submitted  |  ${published} Published`;
    } catch (error) {
        console.error('Error updating category header:', error);
    }
}


// --- 5. NEW MODAL LOGIC ------------------------

/**
 * NEW: Shows the confirmation modal and fetches the event's results.
 */
function showApprovalModal(eventId, eventName, tableRow) {
    const modal = document.getElementById('approval-modal');
    const modalTitle = document.getElementById('modal-event-name');
    const rankingList = document.getElementById('modal-rankings-list');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    // 1. Set up the modal
    modalTitle.textContent = eventName;
    rankingList.innerHTML = '<p>Loading rankings...</p>';
    modal.classList.add('visible');

    // 2. Fetch the ranking data
    loadModalData(eventId, rankingList);

    // 3. Create *new* event listeners for the buttons
    // We clone to remove any old listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // 4. Add the click logic
    newConfirmBtn.addEventListener('click', () => {
        // On confirm, call the *actual* DB update function
        updateEventStatusInDB(eventId, 'approved', tableRow);
        hideApprovalModal();
    });

    newCancelBtn.addEventListener('click', () => {
        hideApprovalModal();
    });
}

/**
 * NEW: Hides the modal.
 */
function hideApprovalModal() {
    const modal = document.getElementById('approval-modal');
    modal.classList.remove('visible');
}

/**
 * NEW: Fetches and renders the rankings inside the modal.
 * This reuses the API from the computation page.
 */
async function loadModalData(eventId, rankingListElement) {
    try {
        // We need an auth token to call this secure API
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');
        const accessToken = sessionData.session.access_token;

        const response = await fetch(`/api/get-event-results?eventId=${eventId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error('Failed to fetch results.');
        
        const results = await response.json();
        rankingListElement.innerHTML = ''; // Clear "Loading..."

        if (results.length === 0) {
            rankingListElement.innerHTML = '<p>No rankings have been submitted for this event yet.</p>';
            return;
        }

        // Build the HTML for each rank
        results.forEach(result => {
            const team = result.teams;
            const rankRow = document.createElement('div');
            rankRow.className = `modal-rank-row rank-${result.rank}`;
            
            rankRow.innerHTML = `
                <div class="modal-rank-num">${result.rank}</div>
                <div class="modal-team-info">
                    <img src="${team.logo_url}" alt="${team.acronym} logo">
                    <span class="acronym">${team.acronym}</span>
                    <span class="name">${team.name}</span>
                </div>
            `;
            rankingListElement.appendChild(rankRow);
        });

    } catch (error) {
        console.error('Error loading modal data:', error);
        rankingListElement.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}