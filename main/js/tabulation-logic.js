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
            // 1. Create the category header (the accordion button)
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            categoryDiv.dataset.details = `category-${category.id}-details`;
            
            // Calculate status counts
            const ongoing = category.events.filter(e => e.status === 'ongoing').length;
            const submitted = category.events.filter(e => e.status === 'for review').length;
            const published = category.events.filter(e => e.status === 'published').length;

            categoryDiv.innerHTML = `
                <div class="cat-title">${category.name}</div>
                <div class="cat-status">${ongoing} ongoing &nbsp;|&nbsp; ${submitted} Submitted &nbsp;|&nbsp; ${published} Published</div>
                <div class="cat-arrow" id="arrow">&#9662;</div>
            `;
            
            // 2. Create the details div (the collapsible part)
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
                            <th>Actions</th> <!-- Merged Filters/Actions -->
                            <th></th> <!-- Extra for delete -->
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Event rows will be built here -->
                    </tbody>
                </table>
            `;

            // 3. Fill the table with event rows
            const tbody = detailsDiv.querySelector('tbody');
            if (category.events.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No events found in this category.</td></tr>`;
            } else {
                category.events.forEach(event => {
                    tbody.appendChild(createEventRow(event));
                });
            }

            // 4. Append to the page
            container.appendChild(categoryDiv);
            container.appendChild(detailsDiv);

            // 5. Add accordion click listener
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
 * This is the single, reusable function that builds an event row.
 */
function createEventRow(event) {
    const tr = document.createElement('tr');
    tr.dataset.eventId = event.id; 

    const eventName = event.name || "Unnamed Event";
    const medalCount = event.medal_value ?? "0"; 
    const statusText = event.status || "N/A";
    const statusClass = event.status ? event.status.replace(' ', '-').toLowerCase() : "none";

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
          <button class="edit-btn" data-id="${event.id}">Edit</button>
          <button class="delete-btn" data-id="${event.id}">Delete</button>
        </td>
    `;

    // Add event listeners for the new buttons
    tr.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Stop accordion from toggling
        handleDeleteEvent(event.id, event.name, tr);
    });

    tr.querySelectorAll('.filter').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const newStatus = e.target.dataset.status;
            handleStatusUpdate(event.id, newStatus, tr);
        });
    });

    return tr;
}

/**
 * Handles the accordion open/close logic.
 * This is from your tabulation-head-script.js.
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

// --- 4. API CALL HANDLERS ------------------------
async function handleStatusUpdate(eventId, newStatus, tableRow) {
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
        
        // Disable the button that was just clicked
        tableRow.querySelectorAll('.filter').forEach(btn => btn.disabled = false);
        tableRow.querySelector(`.filter[data-status="${newStatus}"]`).disabled = true;

        // After updating the row, find the parent and update the header
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
    try {
        // 1. Find the header elements
        const categoryDiv = detailsDiv.previousElementSibling;
        if (!categoryDiv) return;
        const statusDisplay = categoryDiv.querySelector('.cat-status');

        // 2. Find all event rows in this category
        const allRows = detailsDiv.querySelectorAll('tbody tr');

        // 3. Recalculate counts
        let ongoing = 0;
        let submitted = 0;
        let published = 0;

        allRows.forEach(row => {
            const statusSpan = row.querySelector('.status');
            if (!statusSpan) return; 
            
            const status = statusSpan.textContent.toLowerCase();
            
            if (status === 'ongoing') {
                ongoing++;
            } else if (status === 'for review') {
                submitted++;
            } else if (status === 'published') {
                published++;
            }
        });

        // 4. Update the header text
        statusDisplay.textContent = `${ongoing} ongoing  |  ${submitted} Submitted  |  ${published} Published`;

    } catch (error) {
        console.error('Error updating category header:', error);
    }
}