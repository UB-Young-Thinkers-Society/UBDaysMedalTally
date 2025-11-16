// --- 1. AUTHENTICATION & SESSION -------------------
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
            if (role === "committee") window.location.replace("computation.html");
            else if (role === "tabHead") window.location.replace("tabulation.html");
            else window.location.replace("login.html");
        }
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
document.addEventListener('DOMContentLoaded', () => {
    checkSession("tabHead");

    const addTeamForm = document.getElementById('add-team-form');
    const addEventForm = document.getElementById('add-event-form');
    const logoutBtn = document.getElementById('logoutBtn');
    const addLogoInput = document.getElementById('add-logo');
    const logoPreview = document.getElementById('logo-preview'); // Get the preview box

    loadCategories();
    loadTeams(); // This will also attach event listeners for edit/delete

    addTeamForm.addEventListener('submit', handleAddTeam);
    addEventForm.addEventListener('submit', handleAddEvent);
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });

    // --- NEW: Image preview listener ---
    addLogoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                logoPreview.src = e.target.result;
                logoPreview.style.display = 'block'; // Show the image
            };
            reader.readAsDataURL(file);
        } else {
            logoPreview.src = '';
            // logoPreview.style.display = 'none'; // <-- This was part of the original bug, now handled by CSS
        }
    });


    const loader = document.getElementById('loader');
    loader.classList.add('hide');
    setTimeout(() => {
        loader.style.display = 'none';
    }, 600);
});

// --- 3. DYNAMIC DATA LOADING ---------------------
async function loadCategories() {
    const selectEl = document.getElementById('event-category');
    try {
        const response = await fetch('/api/data?type=categories');
        if (!response.ok) throw new Error('Failed to load categories');
        
        const categories = await response.json();

        selectEl.innerHTML = '<option value="" disabled selected>Category</option>'; 
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id; // <-- The UUID
            option.textContent = cat.name; // <-- The visible name
            selectEl.appendChild(option);
        });

    } catch (error) {
        console.error(error);
        selectEl.innerHTML = '<option value="">Failed to load</option>';
    }
}

async function loadTeams() {
    const departmentList = document.querySelector(".department-list");
    try {
        const response = await fetch('/api/data?type=teams');
        if (!response.ok) throw new Error('Failed to load teams');

        const teams = await response.json();

        if (!teams || teams.length === 0) {
            departmentList.innerHTML = "<p>No teams found.</p>";
            return;
        }

        departmentList.innerHTML = ""; 
        teams.forEach(team => {
            const departmentDiv = document.createElement("div");
            departmentDiv.classList.add("department");
            
            departmentDiv.innerHTML = `
                <div class="dept-logo-placeholder">
                    <img src="${team.logo_url}" alt="${team.acronym} Logo" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <span class="dept-name">${team.acronym}</span>
                <button class="edit-btn" data-id="${team.id}">Edit</button>
                <button class="delete-btn" data-id="${team.id}">Delete</button>
            `;
            departmentList.appendChild(departmentDiv);
            
            // --- NEW: Attach listeners to the dynamically created buttons ---
            departmentDiv.querySelector('.edit-btn').addEventListener('click', () => editTeamClicked(team.id));
            departmentDiv.querySelector('.delete-btn').addEventListener('click', () => deleteTeamClicked(team.id, team.name));
        });

    } catch (error) {
        console.error(error);
        departmentList.innerHTML = "<p>Failed to load teams.</p>";
    }
}

// --- NEW: Function to handle Edit button click ---
async function editTeamClicked(teamId) {
    try {
        // Fetch the specific team's details
        const response = await fetch(`/api/data?type=teamById&teamId=${teamId}`); // <-- Uses the new API endpoint
        if (!response.ok) {
            throw new Error(`Failed to load team ${teamId}`);
        }
        const team = await response.json();

        // Populate the form
        document.getElementById('team-name').value = team.name;
        document.getElementById('team-acronym').value = team.acronym;
        
        const logoPreview = document.getElementById('logo-preview');
        logoPreview.src = team.logo_url;
        logoPreview.style.display = 'block'; // Ensure preview is visible

        // Change button text and add data attribute for edit mode
        const submitBtn = document.querySelector('#add-team-form button[type="submit"]');
        submitBtn.textContent = 'Save Changes';
        submitBtn.setAttribute('data-mode', 'edit');
        submitBtn.setAttribute('data-team-id', teamId); // Store the ID for submission

        // Optionally, add a "Cancel Edit" button or clear logic
        const existingCancelBtn = document.getElementById('cancel-edit-btn');
        if (!existingCancelBtn) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.textContent = 'Cancel Edit';
            cancelBtn.type = 'button';
            cancelBtn.classList.add('add-btn'); // Use existing button class for styling
            cancelBtn.style.backgroundColor = '#6c757d'; // Add a grey color
            cancelBtn.addEventListener('click', resetTeamForm);
            submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling); // Insert after submit
        }


    } catch (error) {
        console.error('Error fetching team for edit:', error);
        // MODIFICATION: Use generic modal for error
        showGenericModal('alert', 'Load Error', 'Could not load team details for editing: ' + error.message);
    }
}

// --- NEW: Function to handle Delete button click ---
// MODIFICATION: Replaced confirm() with showGenericModal()
async function deleteTeamClicked(teamId, teamName) {

    // Define the function to run on confirmation
    const onConfirmDelete = async () => {
        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session) {
                throw new Error('Your session has expired. Please log in again.');
            }

            const response = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionData.session.access_token}`
                },
                body: JSON.stringify({
                    action: 'deleteTeam', // New action for backend
                    teamId: teamId
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to delete team.');
            }

            // MODIFICATION: Use generic modal for success
            showGenericModal('alert', 'Success', `Team "<strong>${teamName}</strong>" deleted successfully!`);
            loadTeams(); // Reload the list of teams

        } catch (error) {
            console.error('Error deleting team:', error);
            // MODIFICATION: Use generic modal for error
            showGenericModal('alert', 'Delete Error', 'Error deleting team: ' + error.message);
        }
    };

    // Show the confirmation modal
    showGenericModal(
        'confirm',
        'Delete Team?',
        `Are you sure you want to delete team "<strong>${teamName}</strong>"? This action cannot be undone.`,
        onConfirmDelete
    );
}

// --- NEW: Function to reset the form after edit/add ---
function resetTeamForm() {
    const addTeamForm = document.getElementById('add-team-form');
    addTeamForm.reset(); // Clear all form fields

    // Reset button text and attributes
    const submitBtn = document.querySelector('#add-team-form button[type="submit"]');
    submitBtn.textContent = 'Add Participant';
    submitBtn.removeAttribute('data-mode');
    submitBtn.removeAttribute('data-team-id');

    // Clear and hide logo preview
    const logoPreview = document.getElementById('logo-preview');
    logoPreview.src = '';
    // logoPreview.style.display = 'none'; // <-- THIS LINE IS REMOVED (BUG FIX)
    // By removing this line, the CSS :not([src]) rule will automatically
    // show the empty dashed box.

    // Remove the cancel button if it exists
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) {
        cancelBtn.remove();
    }
}

// --- 4. FORM HANDLERS (CALLING APIs) ----------------

// MODIFICATION: Replaced all alert() calls
async function handleAddTeam(e) {
    e.preventDefault(); 
    
    const nameInput = document.getElementById('team-name');
    const acronymInput = document.getElementById('team-acronym');
    const logoInput = document.getElementById('add-logo');
    const logoPreview = document.getElementById('logo-preview'); // Get preview
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const mode = submitBtn.getAttribute('data-mode') || 'add'; // 'add' or 'edit'
    const teamId = submitBtn.getAttribute('data-team-id'); // Only present in edit mode

    const formData = new FormData();
    formData.append('action', mode === 'edit' ? 'editTeam' : 'addTeam'); // Dynamic action
    formData.append('name', nameInput.value.trim());
    formData.append('acronym', acronymInput.value.trim());
    
    if (logoInput.files[0]) { // Only append if a new file is selected
        formData.append('logoFile', logoInput.files[0]);
    } else if (mode === 'edit' && logoPreview.src && !logoPreview.src.startsWith('data:')) {
        // If in edit mode and no new file, but there's an existing URL, keep it
        formData.append('existing_logo_url', logoPreview.src);
    }


    if (mode === 'edit' && teamId) {
        formData.append('teamId', teamId); // Add teamId for editing
    }

    // --- Validation: Ensure logo is provided when ADDING new team ---
    if (mode === 'add' && !logoInput.files[0]) {
        // MODIFICATION: Use generic modal for validation
        showGenericModal('alert', 'Missing Information', 'Please select a logo file to add a new team.');
        return;
    }

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            throw new Error('Your session has expired. Please log in again.');
        }

        const response = await fetch('/api/actions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionData.session.access_token}`
                // 'Content-Type': 'multipart/form-data' is NOT set here,
                // the browser does it automatically for FormData
            },
            body: formData, 
        });

        if (!response.ok) {
            let errorText = `Error ${response.status}: `;
            const err = await response.json();
            errorText += err.error || 'Unknown server error';
            throw new Error(errorText);
        }

        // MODIFICATION: Use generic modal for success
        showGenericModal('alert', 'Success', `Team ${mode === 'edit' ? 'updated' : 'added'} successfully!`);
        resetTeamForm(); // Clear and reset the form
        loadTeams(); // Reload the list of teams

    } catch (error) {
        console.error(`Error ${mode === 'edit' ? 'updating' : 'adding'} team:`, error);
        // MODIFICATION: Use generic modal for error
        showGenericModal('alert', 'Error', `Error ${mode === 'edit' ? 'updating' : 'adding'} team: ` + error.message);
    }
}

// MODIFICATION: Replaced all alert() calls
async function handleAddEvent(e) {
    e.preventDefault(); 
    const eventNameInput = document.getElementById('event-name');
    const eventCategorySelect = document.getElementById('event-category');
    const eventMedalInput = document.getElementById('event-medal');

    const eventData = {
        action: "addEvent", 
        name: eventNameInput.value.trim(),
        category_id: eventCategorySelect.value,
        medal_value: parseInt(eventMedalInput.value),
    };

    if (!eventData.name || !eventData.category_id || isNaN(eventData.medal_value)) {
        // MODIFICATION: Use generic modal for validation
        showGenericModal('alert', 'Missing Information', 'Please fill out all fields for the event.');
        return;
    }

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            throw new Error('Your session has expired. Please log in again.');
        }

        const response = await fetch('/api/actions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionData.session.access_token}` 
            },
            body: JSON.stringify(eventData),
        });

        if (!response.ok) {
            let errorText = `Error ${response.status}: `;
            const err = await response.json();
            errorText += err.error || 'Server error';
            throw new Error(errorText);
        }

        // MODIFICATION: Use generic modal for success
        showGenericModal('alert', 'Success', 'Event added successfully!');
        eventNameInput.value = '';
        eventCategorySelect.value = '';
        eventMedalInput.value = '';

    } catch (error) {
        console.error('Error adding event:', error);
        // MODIFICATION: Use generic modal for error
        showGenericModal('alert', 'Error', 'Error adding event: ' + error.message);
    }
}

// --- 5. NEW GENERIC MODAL LOGIC ------------------------

/**
 * Shows the generic modal for alerts or confirmations.
 * @param {'alert' | 'confirm'} type - The type of modal to show.
 * @param {string} title - The text for the modal header.
 * @param {string} message - The HTML content for the modal body.
 * @param {function} onConfirm - The callback function to run if 'Confirm' is clicked.
 */
function showGenericModal(type, title, message, onConfirm = () => {}) {
    const modal = document.getElementById('generic-modal-overlay');
    const modalTitle = document.getElementById('generic-modal-title');
    const modalMessage = document.getElementById('generic-modal-message');
    
    const confirmBtn = document.getElementById('generic-modal-btn-confirm');
    const cancelBtn = document.getElementById('generic-modal-btn-cancel');
    const okBtn = document.getElementById('generic-modal-btn-ok');

    // Set content
    modalTitle.textContent = title;
    modalMessage.innerHTML = message; // Use .innerHTML to allow <strong> tags

    // Clone buttons to remove old listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    if (type === 'confirm') {
        // Show confirm/cancel, hide OK
        newConfirmBtn.style.display = 'inline-block';
        newCancelBtn.style.display = 'inline-block';
        newOkBtn.style.display = 'none';

        // Add listeners
        newConfirmBtn.addEventListener('click', () => {
            onConfirm(); // Run the callback
            hideGenericModal();
        });
        newCancelBtn.addEventListener('click', () => {
            hideGenericModal();
        });

    } else if (type === 'alert') {
        // Show OK, hide confirm/cancel
        newConfirmBtn.style.display = 'none';
        newCancelBtn.style.display = 'none';
        newOkBtn.style.display = 'inline-block';

        // Add listener
        newOkBtn.addEventListener('click', () => {
            hideGenericModal();
        });
    }

    // Show the modal
    modal.classList.add('visible');
}

function hideGenericModal() {
    const modal = document.getElementById('generic-modal-overlay');
    modal.classList.remove('visible');
}