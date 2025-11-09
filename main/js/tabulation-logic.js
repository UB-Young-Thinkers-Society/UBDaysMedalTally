// --- 1. AUTHENTICATION & SESSION -------------------

/**
 * Securely checks the user's session and role.
 */
async function checkSession(authorizedRole) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
        window.location.replace("login.html");
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
            window.location.replace("login.html");
            return;
        }

        const { role } = await response.json();

        if (role !== authorizedRole && role !== "admin") {
            console.log("Access Forbidden. Redirecting.");
            if (role === "committee") {
                window.location.replace("computation.html");
            } else {
                window.location.replace("login.html"); // Fallback
            }
        }
        
        console.log("Session valid, user authorized.");

    } catch (error) {
        console.error('Error checking session:', error);
        window.location.replace("login.html");
    }
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error logging out:" + error.message);
    } else {
        console.log("Successfully logged out.");
        window.location.href = 'login.html';
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
            
            // MODIFIED: (1) Re-added the 5th <th> for the delete button
            detailsDiv.innerHTML = `
                <table class="events-table">
                    <thead>
                        <tr>
                            <th>Event Name</th>
                            <th>Medal Count</th>
                            <th>Status</th>
                            <th>Actions</th> 
                            <th></th> <!-- For Delete Button -->
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Event rows will be built here -->
                    </tbody>
                </table>
            `;

            const tbody = detailsDiv.querySelector('tbody');
            if (category.events.length === 0) {
                // MODIFIED: (1) Set colspan back to 5
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
 * MODIFIED: (1) Puts the Delete button back in its own <td>
 */
function createEventRow(event) {
    const tr = document.createElement('tr');
    tr.dataset.eventId = event.id; 
    tr.dataset.eventName = event.name; // Store event name for the modal

    const eventName = event.name || "Unnamed Event";
    const medalCount = event.medal_value ?? "0"; 
    const statusText = event.status || "N/A";
    const statusClass = event.status ? event.status.replace(' ', '-').toLowerCase() : "none";

    // (1) Changed innerHTML to have 5 <td> cells again
    tr.innerHTML = `
        <td>${eventName}</td>
        <td>${medalCount}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td>
          <button class="filter review" data-status="for review">For Review</button>
          <button class="filter approved" data-status="approved">Approved</button>
          <button class="filter published" data-status="published">Published</button>
          <button class="filter locked" data-status="locked">Locked</button>
        </td>
        <td>
          <button class="delete-btn" data-id="${event.id}">Delete</button>
        </td>
    `;
    
    // Highlight the active button
    const activeButton = tr.querySelector(`.filter[data-status="${event.status}"]`);
    if (activeButton) {
        activeButton.disabled = true;
    }

    // Add event listeners for the new buttons
    tr.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Stop accordion from toggling
        handleDeleteEvent(event.id, event.name, tr);
    });

    tr.querySelectorAll('.filter').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const newStatus = e.target.dataset.status;
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
 * MODIFIED: (3) Removed all status restrictions.
 */
async function handleStatusUpdate(eventId, eventName, newStatus, tableRow) {
    const currentStatus = tableRow.querySelector('.status').textContent.toLowerCase();

    // If you click the button that is already active, do nothing.
    if (newStatus === currentStatus) {
        return;
    }

    // If "approved" is clicked, show modal.
    // This is the only special check.
    if (newStatus === 'approved') {
        showApprovalModal(eventId, eventName, tableRow);
        return; // Stop here
    }
    
    // For all other status clicks ("for review", "published", "locked"),
    // just update the status directly.
    await updateEventStatusInDB(eventId, newStatus, tableRow);
}

/**
 * This function *only* calls the API.
 */
async function updateEventStatusInDB(eventId, newStatus, tableRow) {
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');
        const accessToken = sessionData.session.access_token;

        const response = await fetch('/api/update-event-status', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ eventId, newStatus })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update status');
        }

        const newStatusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        tableRow.querySelector('.status').textContent = newStatusText;
        tableRow.querySelector('.status').className = `status ${newStatus.replace(' ', '-').toLowerCase()}`;
        
        tableRow.querySelectorAll('.filter').forEach(btn => btn.disabled = false);
        tableRow.querySelector(`.filter[data-status="${newStatus}"]`).disabled = true;

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
    if (!confirm(`Are you sure you want to delete the event: "${eventName}"?`)) {
        return;
    }
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');
        const accessToken = sessionData.session.access_token;

        const response = await fetch('/api/delete-event', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ eventId })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete event');
        }
        
        tableRow.style.opacity = 0;
        tableRow.style.transition = 'opacity 0.3s';
        setTimeout(() => { 
            tableRow.remove(); 
            const detailsDiv = tableRow.closest('.category-details');
            if (detailsDiv) {
                updateCategoryHeader(detailsDiv);
            }
        }, 300);

    } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error: ' + error.message);
    }
}

function updateCategoryHeader(detailsDiv) {
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


// --- 5. MODAL LOGIC ------------------------

function showApprovalModal(eventId, eventName, tableRow) {
    const modal = document.getElementById('approval-modal');
    const modalTitle = document.getElementById('modal-event-name');
    const rankingList = document.getElementById('modal-rankings-list');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    modalTitle.textContent = eventName;
    rankingList.innerHTML = '<p>Loading rankings...</p>';
    modal.classList.add('visible');

    loadModalData(eventId, rankingList);

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newConfirmBtn.addEventListener('click', () => {
        updateEventStatusInDB(eventId, 'approved', tableRow);
        hideApprovalModal();
    });

    newCancelBtn.addEventListener('click', () => {
        hideApprovalModal();
    });
}

function hideApprovalModal() {
    const modal = document.getElementById('approval-modal');
    modal.classList.remove('visible');
}

/**
 * MODIFIED: (2) Now uses 'result.rank' to display the rank number,
 * which correctly shows ties.
 */
async function loadModalData(eventId, rankingListElement) {
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');
        const accessToken = sessionData.session.access_token;

        const response = await fetch(`/api/get-event-results?eventId=${eventId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error('Failed to fetch results.');
        
        const results = await response.json();
        rankingListElement.innerHTML = ''; 

        if (results.length === 0) {
            rankingListElement.innerHTML = '<p>No rankings have been submitted for this event yet.</p>';
            document.getElementById('modal-confirm-btn').disabled = true;
            document.getElementById('modal-confirm-btn').textContent = 'No Results';
            return;
        }
        
        document.getElementById('modal-confirm-btn').disabled = false;
        document.getElementById('modal-confirm-btn').textContent = 'Confirm';

        results.forEach(result => {
            const team = result.teams;
            const rankRow = document.createElement('div');
            // MODIFIED: (2) Use the real rank for the class
            rankRow.className = `modal-rank-row rank-${result.rank}`;
            
            // MODIFIED: (2) Use the real rank for the text
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
        document.getElementById('modal-confirm-btn').disabled = true;
        document.getElementById('modal-confirm-btn').textContent = 'Error';
    }
}