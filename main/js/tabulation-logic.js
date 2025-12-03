// --- 1. AUTHENTICATION & SESSION (NEW) -------------------

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
        const response = await fetch('/api/auth', {
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

    // --- NEW: EXPORT LISTENER ---
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleExportPDF();
        });
    }

    const loader = document.getElementById('loader');
    loader.classList.add('hide');
    setTimeout(() => { loader.style.display = 'none'; }, 600);
});

// --- 3. DYNAMIC DATA LOADING ---------------------

async function loadAllEvents() {
    try {
        const response = await fetch('/api/data?type=allEvents');
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
            const approved = category.events.filter(e => e.status === 'approved').length;
            const published = category.events.filter(e => e.status === 'published').length;

            categoryDiv.innerHTML = `
                <div class="cat-title">${category.name}</div>
                <div class="cat-status">${ongoing} Ongoing &nbsp;|&nbsp; ${submitted} For Review &nbsp;|&nbsp; ${approved} Approved &nbsp;|&nbsp; ${published} Published</div>
                <div class="cat-arrow" id="arrow">&#9662;</div>
            `;
            
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'category-details';
            detailsDiv.id = `category-${category.id}-details`;
            detailsDiv.style.display = 'none';
            
            detailsDiv.innerHTML = `
                <div class="table-search-wrapper">
                    <input type="search" class="event-search-input" placeholder="Search event name, medal count, or status...">
                </div>
                <table class="events-table">
                    <thead>
                        <tr>
                            <th>Event Name</th>
                            <th>Medal Count</th>
                            <th>Status</th>
                            <th>Actions</th> 
                            <th></th> </tr>
                    </thead>
                    <tbody>
                        </tbody>
                </table>
            `;

            const searchInput = detailsDiv.querySelector('.event-search-input');
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                const table = detailsDiv.querySelector('.events-table');
                const rows = table.querySelectorAll('tbody tr');
                
                rows.forEach(row => {
                    if (row.querySelector('td[colspan="5"]')) {
                        return;
                    }
                    const eventName = row.cells[0].textContent.toLowerCase();
                    const medalCount = row.cells[1].textContent.toLowerCase();
                    const status = row.cells[2].textContent.toLowerCase();
                    const isVisible = eventName.includes(searchTerm) ||
                                      medalCount.includes(searchTerm) ||
                                      status.includes(searchTerm);
                    row.style.display = isVisible ? '' : 'none';
                });
            });

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

function createEventRow(event) {
    const tr = document.createElement('tr');
    tr.dataset.eventId = event.id; 
    tr.dataset.eventName = event.name; 

    const eventName = event.name || "Unnamed Event";
    const medalCount = event.medal_value ?? "0"; 
    const statusText = event.status || "N-A";
    const statusClass = event.status ? event.status.replace(' ', '-').toLowerCase() : "none";

    const currentStatus = event.status || 'ongoing'; 

    const disableForReview = (currentStatus === 'for review') || 
                             (currentStatus === 'ongoing') || 
                             (currentStatus === 'locked');

    const disableApproved = (currentStatus === 'approved') || 
                            (currentStatus === 'ongoing') || 
                            (currentStatus === 'locked');

    const disablePublished = (currentStatus === 'published') || 
                             (currentStatus === 'ongoing') || 
                             (currentStatus === 'for review');

    const disableLocked = (currentStatus !== 'published');

    tr.innerHTML = `
        <td>${eventName}</td>
        <td>${medalCount}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td>
          <button class="filter review" data-status="for review" ${disableForReview ? 'disabled' : ''}>For Review</button>
          <button class="filter approved" data-status="approved" ${disableApproved ? 'disabled' : ''}>Approved</button>
          <button class="filter published" data-status="published" ${disablePublished ? 'disabled' : ''}>Published</button>
          <button class="filter locked" data-status="locked" ${disableLocked ? 'disabled' : ''}>Locked</button>
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
            handleStatusUpdate(event.id, event.name, newStatus, tr);
        });
    });

    return tr;
}

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

// --- 4. API CALL HANDLERS -------------------

async function handleStatusUpdate(eventId, eventName, newStatus, tableRow) {
    const currentStatus = tableRow.querySelector('.status').textContent.toLowerCase();

    if (newStatus === currentStatus) {
        return;
    }

    if (newStatus === 'approved') {
        showApprovalModal(eventId, eventName, tableRow);
        return; 
    }
    
    await updateEventStatusInDB(eventId, newStatus, tableRow);
}

async function updateEventStatusInDB(eventId, newStatus, tableRow) {
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');
        const accessToken = sessionData.session.access_token;

        const response = await fetch('/api/actions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ 
                action: "updateEventStatus", 
                eventId, 
                newStatus 
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update status');
        }

        const newStatusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        tableRow.querySelector('.status').textContent = newStatusText;
        tableRow.querySelector('.status').className = `status ${newStatus.replace(' ', '-').toLowerCase()}`;
        
        const reviewBtn = tableRow.querySelector('.filter.review');
        const approvedBtn = tableRow.querySelector('.filter.approved');
        const publishedBtn = tableRow.querySelector('.filter.published');
        const lockedBtn = tableRow.querySelector('.filter.locked');

        const currentStatus = newStatus; 

        reviewBtn.disabled = (currentStatus === 'for review') || 
                             (currentStatus === 'ongoing') || 
                             (currentStatus === 'locked');

        approvedBtn.disabled = (currentStatus === 'approved') || 
                               (currentStatus === 'ongoing') || 
                               (currentStatus === 'locked');

        publishedBtn.disabled = (currentStatus === 'published') || 
                                (currentStatus === 'ongoing') || 
                                (currentStatus === 'for review');

        lockedBtn.disabled = (currentStatus !== 'published');

        const detailsDiv = tableRow.closest('.category-details');
        if (detailsDiv) {
            updateCategoryHeader(detailsDiv);
        }

    } catch (error) {
        console.error('Error updating status:', error);
        showGenericModal('alert', 'Update Error', 'Error: ' + error.message);
    }
}

async function handleDeleteEvent(eventId, eventName, tableRow) {
    const onConfirmDelete = async () => {
        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session) throw new Error('Session expired.');
            const accessToken = sessionData.session.access_token;

            const response = await fetch('/api/actions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ 
                    action: "deleteEvent", 
                    eventId 
                })
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
            showGenericModal('alert', 'Delete Error', 'Error: ' + error.message);
        }
    };

    showGenericModal(
        'confirm',
        'Delete Event?',
        `Are you sure you want to delete the event: <strong>"${eventName}"</strong>? This action cannot be undone.`,
        onConfirmDelete
    );
}

function updateCategoryHeader(detailsDiv) {
    try {
        const categoryDiv = detailsDiv.previousElementSibling;
        if (!categoryDiv) return;
        const statusDisplay = categoryDiv.querySelector('.cat-status');
        const allRows = detailsDiv.querySelectorAll('tbody tr');
        let ongoing = 0, approved = 0, submitted = 0, published = 0;
        allRows.forEach(row => {
            const statusSpan = row.querySelector('.status');
            if (!statusSpan) return; 
            const status = statusSpan.textContent.toLowerCase();
            if (status === 'ongoing') ongoing++;
            else if (status === 'for review') submitted++;
            else if (status === 'approved') approved++;
            else if (status === 'published') published++;
        });
        statusDisplay.textContent = `${ongoing} Ongoing   |   ${submitted} For Review   |   ${approved} Approved   |   ${published} Published`;
    } catch (error) {
        console.error('Error updating category header:', error);
    }
}

// --- 5. MODAL LOGIC (APPROVAL) ------------------------

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

async function loadModalData(eventId, rankingListElement) {
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');
        const accessToken = sessionData.session.access_token;

        const response = await fetch(`/api/data?type=eventResults&eventId=${eventId}`, {
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
        document.getElementById('modal-confirm-btn').disabled = true;
        document.getElementById('modal-confirm-btn').textContent = 'Error';
    }
}

// --- 6. GENERIC MODAL LOGIC ------------------------

function showGenericModal(type, title, message, onConfirm = () => {}) {
    const modal = document.getElementById('generic-modal-overlay');
    const modalTitle = document.getElementById('generic-modal-title');
    const modalMessage = document.getElementById('generic-modal-message');
    
    const confirmBtn = document.getElementById('generic-modal-btn-confirm');
    const cancelBtn = document.getElementById('generic-modal-btn-cancel');
    const okBtn = document.getElementById('generic-modal-btn-ok');

    modalTitle.textContent = title;
    modalMessage.innerHTML = message; 

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    if (type === 'confirm') {
        newConfirmBtn.style.display = 'inline-block';
        newCancelBtn.style.display = 'inline-block';
        newOkBtn.style.display = 'none';

        newConfirmBtn.addEventListener('click', () => {
            onConfirm(); 
            hideGenericModal();
        });
        newCancelBtn.addEventListener('click', () => {
            hideGenericModal();
        });

    } else if (type === 'alert') {
        newConfirmBtn.style.display = 'none';
        newCancelBtn.style.display = 'none';
        newOkBtn.style.display = 'inline-block';

        newOkBtn.addEventListener('click', () => {
            hideGenericModal();
        });
    }

    modal.classList.add('visible');
}

function hideGenericModal() {
    const modal = document.getElementById('generic-modal-overlay');
    modal.classList.remove('visible');
}


// --- 7. NEW: PDF EXPORT LOGIC ------------------------

async function handleExportPDF() {
    const exportBtn = document.getElementById('exportBtn');
    exportBtn.textContent = 'Generating PDF...';
    exportBtn.style.pointerEvents = 'none';
    exportBtn.style.opacity = '0.7';

    // Show spinner
    const loader = document.getElementById('loader');
    loader.style.display = 'flex';
    loader.classList.remove('hide');

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Define standard UB colors
        const colors = {
            blue: [45, 91, 227], // #2d5be3
            yellow: [255, 200, 0], // #ffc800
            red: [175, 76, 76], // #af4c4c
            gold: [255, 215, 0],
            silver: [192, 192, 192],
            bronze: [205, 127, 50],
            dark: [51, 51, 51],
            lightGray: [240, 240, 240]
        };

        const todayStr = new Date().toLocaleString();

        // ----------------------------------------------------
        // PHASE 1: OVERALL MEDAL TALLY (Page 1)
        // ----------------------------------------------------
        
        // Fetch data for page 1
        const tallyResponse = await fetch('/api/data?type=medalTally');
        if (!tallyResponse.ok) throw new Error('Failed to fetch medal tally');
        const tallyData = await tallyResponse.json();

        // Title
        doc.setFontSize(22);
        doc.setTextColor(...colors.dark);
        doc.text("UB Days 2025 - Official Medal Tally", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${todayStr}`, 14, 28);

        // Define Table Headers
        const tallyHead = [['Rank', 'Department', 'Gold', 'Silver', 'Bronze', 'Total']];
        const tallyBody = tallyData.map((team, index) => [
            index + 1,
            team.name,
            team.gold,
            team.silver,
            team.bronze,
            team.total
        ]);

        doc.autoTable({
            startY: 35,
            head: tallyHead,
            body: tallyBody,
            theme: 'grid',
            headStyles: { fillColor: colors.blue, textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'center', fontStyle: 'bold' }, // Rank
                2: { halign: 'center', textColor: [200, 150, 0] }, // Gold (Dark Gold color)
                3: { halign: 'center', textColor: [100, 100, 100] }, // Silver
                4: { halign: 'center', textColor: [150, 90, 30] }, // Bronze
                5: { halign: 'center', fontStyle: 'bold' } // Total
            },
            alternateRowStyles: { fillColor: colors.lightGray }
        });


        // ----------------------------------------------------
        // PHASE 2: CATEGORICAL SUMMARIES (Page 2+)
        // ----------------------------------------------------
        
        doc.addPage();
        doc.setFontSize(18);
        doc.setTextColor(...colors.dark);
        doc.text("Categorical Summary", 14, 20);

        // 1. Fetch Categories
        const categoriesResponse = await fetch('/api/data?type=allEvents');
        if (!categoriesResponse.ok) throw new Error('Failed to fetch categories');
        const categories = await categoriesResponse.json();

        // 2. Fetch details for *published* events only
        // This is complex. We need to iterate categories, find events, and get winners.
        
        let startY = 30;

        for (const category of categories) {
            
            // Check if page break is needed before header
            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            // Print Category Name
            doc.setFontSize(14);
            doc.setTextColor(...colors.blue);
            doc.setFont("helvetica", "bold");
            doc.text(category.name, 14, startY);
            startY += 8;

            const categoryTableBody = [];

            // Get events for this category
            for (const event of category.events) {
                // We only care about published events for the report
                if (event.status !== 'published') continue;

                // Fetch results for this specific event
                const { data: sessionData } = await supabase.auth.getSession();
                const resResponse = await fetch(`/api/data?type=eventResults&eventId=${event.id}`, {
                    headers: { 'Authorization': `Bearer ${sessionData.session.access_token}` }
                });
                
                if (resResponse.ok) {
                    const results = await resResponse.json();
                    
                    // Find winners
                    let goldWinner = results.find(r => r.rank === 1)?.teams.acronym || "-";
                    let silverWinner = results.find(r => r.rank === 2)?.teams.acronym || "-";
                    let bronzeWinner = results.find(r => r.rank === 3)?.teams.acronym || "-";
                    
                    // Handle ties (simplified: join acronyms)
                    const goldTies = results.filter(r => r.rank === 1).map(r => r.teams.acronym);
                    if (goldTies.length > 1) goldWinner = goldTies.join(" / ");
                    
                    const silverTies = results.filter(r => r.rank === 2).map(r => r.teams.acronym);
                    if (silverTies.length > 1) silverWinner = silverTies.join(" / ");

                    const bronzeTies = results.filter(r => r.rank === 3).map(r => r.teams.acronym);
                    if (bronzeTies.length > 1) bronzeWinner = bronzeTies.join(" / ");

                    categoryTableBody.push([
                        event.name,
                        event.medal_value || 0, // NEW COLUMN: Medal Value
                        goldWinner,
                        silverWinner,
                        bronzeWinner
                    ]);
                }
            }

            if (categoryTableBody.length > 0) {
                doc.autoTable({
                    startY: startY,
                    head: [['Event Name', 'Medal Value', 'Gold', 'Silver', 'Bronze']], // NEW HEADER
                    body: categoryTableBody,
                    theme: 'striped',
                    headStyles: { fillColor: colors.red, textColor: 255 },
                    columnStyles: {
                        1: { halign: 'center' }, // Center medal value
                        2: { fontStyle: 'bold', textColor: [200, 150, 0] },
                        3: { fontStyle: 'bold', textColor: [100, 100, 100] },
                        4: { fontStyle: 'bold', textColor: [150, 90, 30] }
                    },
                    margin: { left: 14, right: 14 }
                });
                startY = doc.lastAutoTable.finalY + 15;
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.setFont("helvetica", "italic");
                doc.text("(No published results yet)", 14, startY);
                doc.setFont("helvetica", "normal");
                startY += 15;
            }
        }


        // ----------------------------------------------------
        // PHASE 3: TEAM SUMMARIES (Page X+)
        // ----------------------------------------------------

        doc.addPage();
        doc.setFontSize(18);
        doc.setTextColor(...colors.dark);
        doc.text("Team Performance Summary", 14, 20);
        startY = 30;

        // 1. Fetch Teams
        const teamsResponse = await fetch('/api/data?type=teams');
        if (!teamsResponse.ok) throw new Error('Failed to fetch teams');
        const teams = await teamsResponse.json();
        
        // Sort teams alphabetically
        teams.sort((a, b) => a.name.localeCompare(b.name));

        for (const team of teams) {
             // Check if page break is needed
             if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            // Fetch results for this team
            const teamResResponse = await fetch(`/api/data?type=departmentResults&teamId=${team.id}`);
            if (teamResResponse.ok) {
                const teamData = await teamResResponse.json();
                
                // Team Header
                doc.setFontSize(14);
                doc.setTextColor(...colors.blue);
                doc.setFont("helvetica", "bold");
                const medalSummary = `(G: ${teamData.totals.totalGold}, S: ${teamData.totals.totalSilver}, B: ${teamData.totals.totalBronze})`;
                doc.text(`${team.name} ${medalSummary}`, 14, startY);
                startY += 8;

                // --- MODIFIED: COLLECT DATA AND SORT ---
                const rawRows = [];

                // data.categories is an Object { "CategoryName": [events...] }
                Object.keys(teamData.categories).forEach(catName => {
                    teamData.categories[catName].forEach(result => {
                        let medalType = "";
                        let medalValue = 0; // NEW: Capture value for display
                        let sortOrder = 4; // 1=Gold, 2=Silver, 3=Bronze

                        // Determine medal and sort order
                        if (result.gold > 0) {
                            medalType = "Gold";
                            medalValue = result.gold;
                            sortOrder = 1;
                        } else if (result.silver > 0) {
                            medalType = "Silver";
                            medalValue = result.silver;
                            sortOrder = 2;
                        } else if (result.bronze > 0) {
                            medalType = "Bronze";
                            medalValue = result.bronze;
                            sortOrder = 3;
                        }

                        // Only add if they actually won something
                        if (medalType !== "") {
                            rawRows.push({
                                category: catName,
                                event: result.event_name,
                                value: medalValue,
                                medal: medalType,
                                order: sortOrder
                            });
                        }
                    });
                });

                // Sort: Gold -> Silver -> Bronze, then alphabetically by Event
                rawRows.sort((a, b) => {
                    if (a.order !== b.order) {
                        return a.order - b.order; // Primary: Medal Rank
                    }
                    return a.event.localeCompare(b.event); // Secondary: Event Name
                });

                // Map to table body format: [Category, Event, Points, Medal]
                const teamTableBody = rawRows.map(row => [
                    row.category,
                    row.event,
                    row.value, // Points
                    row.medal  // Medal
                ]);

                if (teamTableBody.length > 0) {
                    doc.autoTable({
                        startY: startY,
                        head: [['Category', 'Event Name', 'Medal Value', 'Placement']], // NEW HEADER
                        body: teamTableBody,
                        theme: 'grid',
                        headStyles: { fillColor: [80, 80, 80], textColor: 255 }, // Dark Gray
                        columnStyles: {
                            2: { halign: 'center' }, // Center points
                            3: { fontStyle: 'bold' } // Medal column
                        },
                        // Custom cell styling for medals
                        didParseCell: function(data) {
                            if (data.section === 'body' && data.column.index === 3) {
                                if (data.cell.raw === 'Gold') data.cell.styles.textColor = [200, 150, 0];
                                if (data.cell.raw === 'Silver') data.cell.styles.textColor = [100, 100, 100];
                                if (data.cell.raw === 'Bronze') data.cell.styles.textColor = [150, 90, 30];
                            }
                        },
                        margin: { left: 14, right: 14 }
                    });
                    startY = doc.lastAutoTable.finalY + 15;
                } else {
                    doc.setFontSize(10);
                    doc.setTextColor(150);
                    doc.setFont("helvetica", "italic");
                    doc.text("No medals won yet.", 14, startY);
                    startY += 15;
                }

            }
        }

        // Save
        doc.save(`UBDays2025_Full_Report.pdf`);

        showGenericModal('alert', 'Export Complete', 'The PDF report has been downloaded successfully.');

    } catch (error) {
        console.error('Export error:', error);
        showGenericModal('alert', 'Export Error', 'Failed to generate PDF: ' + error.message);
    } finally {
        // Reset UI
        loader.classList.add('hide');
        setTimeout(() => { loader.style.display = 'none'; }, 600);
        exportBtn.textContent = 'Export';
        exportBtn.style.pointerEvents = 'auto';
        exportBtn.style.opacity = '1';
    }
}