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

// Global state for accounts management
let accountsList = [];
let visibleSecrets = {
    email: {},
    password: {}
};
let currentPrivilegeTargetUser = null;

// --- 2. PAGE INITIALIZATION ------------------------
document.addEventListener('DOMContentLoaded', () => {
    checkSession("tabHead");

    const addTeamForm = document.getElementById('add-team-form');
    const addEventForm = document.getElementById('add-event-form');
    const logoutBtn = document.getElementById('logoutBtn');
    const addLogoInput = document.getElementById('add-logo');
    const logoPreview = document.getElementById('logo-preview');
    const uploadIcon = document.getElementById('upload-icon-svg');

    loadCategories();
    loadTeams();
    initAccountsManagement();
    initCategoryModal();

    addTeamForm.addEventListener('submit', handleAddTeam);
    addEventForm.addEventListener('submit', handleAddEvent);
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });

    // Logo file picker preview listener (Fix: clean icon / preview swap without broken image)
    addLogoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                logoPreview.src = e.target.result;
                logoPreview.style.display = 'block';
                if (uploadIcon) uploadIcon.style.display = 'none';
            };
            reader.readAsDataURL(file);
        } else {
            logoPreview.removeAttribute('src');
            logoPreview.style.display = 'none';
            if (uploadIcon) uploadIcon.style.display = 'block';
        }
    });

    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hide');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 600);
    }
});

// --- 3. DYNAMIC DATA LOADING ---------------------
async function loadCategories(selectedId = null) {
    const selectEl = document.getElementById('event-category');
    try {
        const response = await fetch('/api/data?type=categories');
        if (!response.ok) throw new Error('Failed to load categories');
        
        const categories = await response.json();

        selectEl.innerHTML = '<option value="" disabled selected>Category</option>'; 
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            if (selectedId && (cat.id === selectedId || cat.name.toLowerCase() === selectedId.toLowerCase())) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        });

    } catch (error) {
        console.error(error);
        selectEl.innerHTML = '<option value="">Failed to load</option>';
    }
}

async function loadTeams() {
    const departmentList = document.querySelector(".department-list");
    const countBadge = document.getElementById('teams-count-badge');
    try {
        const response = await fetch('/api/data?type=teams');
        if (!response.ok) throw new Error('Failed to load teams');

        const teams = await response.json();

        if (countBadge) {
            countBadge.textContent = `${teams ? teams.length : 0} Teams`;
        }

        if (!teams || teams.length === 0) {
            departmentList.innerHTML = "<p style='color:#888;font-size:0.9rem;padding:12px;text-align:center;'>No teams registered yet.</p>";
            return;
        }

        departmentList.innerHTML = ""; 
        teams.forEach(team => {
            const departmentDiv = document.createElement("div");
            departmentDiv.classList.add("department");
            
            departmentDiv.innerHTML = `
                <div class="dept-logo-placeholder">
                    <img src="${team.logo_url}" alt="${escapeHtml(team.acronym)} Logo" loading="lazy">
                </div>
                <div class="dept-info">
                    <span class="dept-acronym">${escapeHtml(team.acronym)}</span>
                    <span class="dept-fullname" title="${escapeHtml(team.name)}">${escapeHtml(team.name)}</span>
                </div>
                <div class="dept-actions">
                    <button type="button" class="btn-team-action edit-btn" data-id="${team.id}" title="Edit Team">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button type="button" class="btn-team-action btn-delete delete-btn" data-id="${team.id}" title="Delete Team">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            departmentList.appendChild(departmentDiv);
            
            departmentDiv.querySelector('.edit-btn').addEventListener('click', () => editTeamClicked(team.id));
            departmentDiv.querySelector('.delete-btn').addEventListener('click', () => deleteTeamClicked(team.id, team.name));
        });

        // --- Render Juniors League Teams Section ---
        renderJuniorsLeagueList(teams);

    } catch (error) {
        console.error(error);
        departmentList.innerHTML = "<p style='color:#ef4444;padding:8px;'>Failed to load teams.</p>";
        const juniorsList = document.getElementById('juniors-list');
        if (juniorsList) {
            juniorsList.innerHTML = "<p style='color:#ef4444;padding:8px;'>Failed to load teams.</p>";
        }
    }
}

/**
 * Renders the Juniors League selection list with toggles
 */
function renderJuniorsLeagueList(teams) {
    const juniorsList = document.getElementById('juniors-list');
    const juniorsBadge = document.getElementById('juniors-count-badge');
    if (!juniorsList) return;

    if (!teams || teams.length === 0) {
        juniorsList.innerHTML = "<p style='color:#888;font-size:0.9rem;padding:12px;text-align:center;'>No teams available.</p>";
        if (juniorsBadge) juniorsBadge.textContent = "0 Teams";
        return;
    }

    const juniorCount = teams.filter(t => Boolean(t.is_junior)).length;
    if (juniorsBadge) {
        juniorsBadge.textContent = `${juniorCount} Team${juniorCount === 1 ? '' : 's'}`;
    }

    juniorsList.innerHTML = "";
    teams.forEach(team => {
        const itemDiv = document.createElement("div");
        itemDiv.classList.add("department", "junior-team-item");

        const isChecked = Boolean(team.is_junior);

        itemDiv.innerHTML = `
            <div class="dept-logo-placeholder">
                <img src="${team.logo_url}" alt="${escapeHtml(team.acronym)} Logo" loading="lazy">
            </div>
            <div class="dept-info">
                <span class="dept-acronym">${escapeHtml(team.acronym)}</span>
                <span class="dept-fullname" title="${escapeHtml(team.name)}">${escapeHtml(team.name)}</span>
            </div>
            <div class="junior-toggle-wrap">
                <label class="switch-toggle" title="Toggle Juniors League participation">
                    <input type="checkbox" class="junior-checkbox" data-id="${team.id}" data-name="${escapeHtml(team.name)}" ${isChecked ? 'checked' : ''}>
                    <span class="slider-round"></span>
                </label>
            </div>
        `;

        juniorsList.appendChild(itemDiv);

        const checkbox = itemDiv.querySelector('.junior-checkbox');
        checkbox.addEventListener('change', async (e) => {
            const newStatus = e.target.checked;
            await handleToggleJunior(team.id, newStatus, team.name, e.target);
        });
    });
}

/**
 * Handles toggling a team's junior status via /api/actions
 */
async function handleToggleJunior(teamId, isJunior, teamName, checkboxEl) {
    try {
        if (checkboxEl) checkboxEl.disabled = true;

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
                action: 'toggleJuniorStatus',
                teamId: teamId,
                isJunior: isJunior
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update team league status.');
        }

        // Recalculate badge count dynamically
        const allCheckboxes = document.querySelectorAll('.junior-checkbox');
        let activeCount = 0;
        allCheckboxes.forEach(cb => {
            if (cb.checked) activeCount++;
        });
        const juniorsBadge = document.getElementById('juniors-count-badge');
        if (juniorsBadge) {
            juniorsBadge.textContent = `${activeCount} Team${activeCount === 1 ? '' : 's'}`;
        }

    } catch (error) {
        console.error('Error toggling junior status:', error);
        if (checkboxEl) {
            checkboxEl.checked = !isJunior; // Revert checkbox state
        }
        showGenericModal('alert', 'Update Failed', `Could not update league status for "${escapeHtml(teamName)}": ${error.message}`);
    } finally {
        if (checkboxEl) checkboxEl.disabled = false;
    }
}

// Function to handle Edit team
async function editTeamClicked(teamId) {
    try {
        const response = await fetch(`/api/data?type=teamById&teamId=${teamId}`);
        if (!response.ok) throw new Error(`Failed to load team ${teamId}`);
        const team = await response.json();

        document.getElementById('team-name').value = team.name;
        document.getElementById('team-acronym').value = team.acronym;
        
        const logoPreview = document.getElementById('logo-preview');
        const uploadIcon = document.getElementById('upload-icon-svg');
        if (team.logo_url) {
            logoPreview.src = team.logo_url;
            logoPreview.style.display = 'block';
            if (uploadIcon) uploadIcon.style.display = 'none';
        } else {
            logoPreview.removeAttribute('src');
            logoPreview.style.display = 'none';
            if (uploadIcon) uploadIcon.style.display = 'block';
        }

        const heading = document.getElementById('team-form-heading');
        if (heading) heading.textContent = 'Edit Team Details';

        const submitBtn = document.getElementById('team-submit-btn') || document.querySelector('#add-team-form button[type="submit"]');
        submitBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Save Changes</span>
        `;
        submitBtn.setAttribute('data-mode', 'edit');
        submitBtn.setAttribute('data-team-id', teamId);

        const btnRow = document.getElementById('team-buttons-row') || submitBtn.parentNode;
        const existingCancelBtn = document.getElementById('cancel-edit-btn');
        if (!existingCancelBtn) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.type = 'button';
            cancelBtn.classList.add('btn-cancel-edit');
            cancelBtn.addEventListener('click', resetTeamForm);
            btnRow.appendChild(cancelBtn);
        }

    } catch (error) {
        console.error('Error fetching team for edit:', error);
        showGenericModal('alert', 'Load Error', 'Could not load team details for editing: ' + error.message);
    }
}

// Function to handle Delete team
async function deleteTeamClicked(teamId, teamName) {
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
                    action: 'deleteTeam',
                    teamId: teamId
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to delete team.');
            }

            showGenericModal('alert', 'Success', `Team "<strong>${escapeHtml(teamName)}</strong>" deleted successfully!`);
            loadTeams();

        } catch (error) {
            console.error('Error deleting team:', error);
            showGenericModal('alert', 'Delete Error', 'Error deleting team: ' + error.message);
        }
    };

    showGenericModal(
        'confirm',
        'Delete Team?',
        `Are you sure you want to delete team "<strong>${escapeHtml(teamName)}</strong>"? This action cannot be undone.`,
        onConfirmDelete
    );
}

function resetTeamForm() {
    const addTeamForm = document.getElementById('add-team-form');
    addTeamForm.reset();

    const heading = document.getElementById('team-form-heading');
    if (heading) heading.textContent = 'Team Registration';

    const submitBtn = document.getElementById('team-submit-btn') || document.querySelector('#add-team-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Add Participant</span>
        `;
        submitBtn.removeAttribute('data-mode');
        submitBtn.removeAttribute('data-team-id');
    }

    const logoPreview = document.getElementById('logo-preview');
    logoPreview.removeAttribute('src');
    logoPreview.style.display = 'none';

    const uploadIcon = document.getElementById('upload-icon-svg');
    if (uploadIcon) uploadIcon.style.display = 'block';

    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.remove();
}

// --- 4. FORM HANDLERS (TEAMS & EVENTS) ----------------
async function handleAddTeam(e) {
    e.preventDefault(); 
    
    const nameInput = document.getElementById('team-name');
    const acronymInput = document.getElementById('team-acronym');
    const logoInput = document.getElementById('add-logo');
    const logoPreview = document.getElementById('logo-preview');
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const mode = submitBtn.getAttribute('data-mode') || 'add';
    const teamId = submitBtn.getAttribute('data-team-id');

    const formData = new FormData();
    formData.append('action', mode === 'edit' ? 'editTeam' : 'addTeam');
    formData.append('name', nameInput.value.trim());
    formData.append('acronym', acronymInput.value.trim());
    
    if (logoInput.files[0]) {
        formData.append('logoFile', logoInput.files[0]);
    } else if (mode === 'edit' && logoPreview.src && !logoPreview.src.startsWith('data:')) {
        formData.append('existing_logo_url', logoPreview.src);
    }

    if (mode === 'edit' && teamId) {
        formData.append('teamId', teamId);
    }

    if (mode === 'add' && !logoInput.files[0]) {
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
            },
            body: formData, 
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Server error');
        }

        showGenericModal('alert', 'Success', `Team ${mode === 'edit' ? 'updated' : 'added'} successfully!`);
        resetTeamForm();
        loadTeams();

    } catch (error) {
        console.error(`Error ${mode === 'edit' ? 'updating' : 'adding'} team:`, error);
        showGenericModal('alert', 'Error', `Error ${mode === 'edit' ? 'updating' : 'adding'} team: ` + error.message);
    }
}

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
            const err = await response.json();
            throw new Error(err.error || 'Failed to add event');
        }

        showGenericModal('alert', 'Success', `Event "<strong>${escapeHtml(eventData.name)}</strong>" added successfully!`);
        eventNameInput.value = '';
        eventCategorySelect.value = '';
        eventMedalInput.value = '';

    } catch (error) {
        console.error('Error adding event:', error);
        showGenericModal('alert', 'Error', 'Error adding event: ' + error.message);
    }
}

// --- 5. CATEGORY MODAL LOGIC (REQUIREMENT #3) ------------
function initCategoryModal() {
    const openBtn = document.getElementById('open-category-modal-btn');
    const modalOverlay = document.getElementById('add-category-modal-overlay');
    const closeBtn = document.getElementById('close-category-modal-x');
    const cancelBtn = document.getElementById('cancel-category-btn');
    const submitBtn = document.getElementById('submit-category-btn');
    const inputEl = document.getElementById('new-category-name');

    if (!openBtn || !modalOverlay) return;

    const openModal = () => {
        inputEl.value = '';
        modalOverlay.classList.add('visible');
        setTimeout(() => inputEl.focus(), 150);
    };

    const closeModal = () => {
        modalOverlay.classList.remove('visible');
    };

    openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    submitBtn.addEventListener('click', async () => {
        const catName = inputEl.value.trim();
        if (!catName) {
            inputEl.focus();
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';

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
                    action: 'addCategory',
                    name: catName
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to add category');
            }

            const resData = await response.json();
            const newCatId = resData.data?.id;

            closeModal();
            await loadCategories(newCatId);
            showGenericModal('alert', 'Category Added', `Category "<strong>${escapeHtml(catName)}</strong>" has been created and added to the list.`);

        } catch (err) {
            console.error('Error adding category:', err);
            showGenericModal('alert', 'Error', 'Failed to add category: ' + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Category';
        }
    });

    // Enter key submits
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitBtn.click();
        }
    });
}

// --- 6. ACCOUNTS MANAGEMENT LOGIC (REQUIREMENT #4) -------
function initAccountsManagement() {
    const searchInput = document.getElementById('accounts-search-input');
    const openAddBtn = document.getElementById('open-add-account-btn');

    // Modals
    const accountModal = document.getElementById('account-form-modal-overlay');
    const closeAccountX = document.getElementById('close-account-modal-x');
    const cancelAccountBtn = document.getElementById('cancel-account-modal-btn');
    const submitAccountBtn = document.getElementById('submit-account-modal-btn');
    const generatePwBtn = document.getElementById('btn-generate-pw');

    const privModal = document.getElementById('privileges-modal-overlay');
    const closePrivX = document.getElementById('close-privileges-modal-x');
    const cancelPrivBtn = document.getElementById('cancel-privileges-btn');
    const submitPrivBtn = document.getElementById('submit-privileges-btn');

    // Search filter
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderAccountsTable();
        });
    }

    // Open Add Account modal
    if (openAddBtn) {
        openAddBtn.addEventListener('click', () => {
            openAccountModal('create');
        });
    }

    // Generate random password helper
    if (generatePwBtn) {
        generatePwBtn.addEventListener('click', () => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
            let gen = 'Ub';
            for (let i = 0; i < 7; i++) {
                gen += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            document.getElementById('modal-account-password').value = gen;
        });
    }

    // Close account modal handlers
    if (closeAccountX) closeAccountX.addEventListener('click', closeAccountModal);
    if (cancelAccountBtn) cancelAccountBtn.addEventListener('click', closeAccountModal);

    // Submit Add / Edit Account
    if (submitAccountBtn) {
        submitAccountBtn.addEventListener('click', handleSaveAccount);
    }

    // Close Privileges modal handlers
    if (closePrivX) closePrivX.addEventListener('click', closePrivilegesModal);
    if (cancelPrivBtn) cancelPrivBtn.addEventListener('click', closePrivilegesModal);

    // Submit Privileges
    if (submitPrivBtn) {
        submitPrivBtn.addEventListener('click', handleSavePrivileges);
    }

    // Privilege card clickable toggle
    document.querySelectorAll('.privilege-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const chk = card.querySelector('.priv-chk');
                if (chk) {
                    chk.checked = !chk.checked;
                    card.classList.toggle('checked', chk.checked);
                }
            } else {
                card.classList.toggle('checked', e.target.checked);
            }
        });
    });

    loadAccounts();
}

async function loadAccounts() {
    const tbody = document.getElementById('accounts-tbody');
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) return;

        const res = await fetch('/api/accounts', {
            headers: {
                'Authorization': `Bearer ${sessionData.session.access_token}`
            }
        });

        if (!res.ok) {
            throw new Error(`Failed to load accounts (${res.status})`);
        }

        const data = await res.json();
        accountsList = data.accounts || [];

        // By default, leave all passwords and emails masked for privacy
        accountsList.forEach(a => {
            if (visibleSecrets.email[a.id] === undefined) visibleSecrets.email[a.id] = false;
            if (visibleSecrets.password[a.id] === undefined) visibleSecrets.password[a.id] = false;
        });

        renderAccountsTable();

    } catch (err) {
        console.error('Error loading accounts:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444; padding: 20px;">Could not load accounts: ${escapeHtml(err.message)}</td></tr>`;
        }
    }
}

function renderAccountsTable() {
    const tbody = document.getElementById('accounts-tbody');
    const searchInput = document.getElementById('accounts-search-input');
    const query = (searchInput?.value || '').toLowerCase().trim();

    if (!tbody) return;

    const filtered = accountsList.filter(a => {
        if (!query) return true;
        const email = (a.email || '').toLowerCase();
        const role = (a.role || '').toLowerCase();
        return email.includes(query) || role.includes(query);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 28px;">No accounts match "${escapeHtml(query)}"</td></tr>`;
        return;
    }

    tbody.innerHTML = '';

    filtered.forEach(acc => {
        const tr = document.createElement('tr');

        // Email visibility
        const isEmailVisible = !!visibleSecrets.email[acc.id];
        const displayEmail = isEmailVisible ? acc.email : maskEmail(acc.email);

        // Password visibility
        const isPwVisible = !!visibleSecrets.password[acc.id];
        const rawPassword = acc.password || '••••••••';
        const displayPassword = isPwVisible ? rawPassword : '•••••••••••••';

        // Badge styling
        const roleKey = (acc.role || 'committee').toLowerCase();
        let badgeClass = 'role-badge badge-committee';
        let badgeLabel = 'COMMITTEE';
        if (roleKey === 'admin') {
            badgeClass = 'role-badge badge-admin';
            badgeLabel = 'ADMIN';
        } else if (roleKey === 'tabhead') {
            badgeClass = 'role-badge badge-tabhead';
            badgeLabel = 'TABHEAD';
        }

        tr.innerHTML = `
            <td>
                <div class="secret-container">
                    <span class="secret-text email-text" style="color:#0f172a; font-weight: 500;">${escapeHtml(displayEmail)}</span>
                    <button type="button" class="btn-toggle-eye toggle-email-btn" data-id="${acc.id}" title="${isEmailVisible ? 'Mask email' : 'Reveal email'}">
                        ${getEyeIconSvg(isEmailVisible)}
                    </button>
                </div>
            </td>
            <td>
                <div class="secret-container">
                    <span class="secret-text password-text" style="color:#334155;">${escapeHtml(displayPassword)}</span>
                    <button type="button" class="btn-toggle-eye toggle-pw-btn" data-id="${acc.id}" title="${isPwVisible ? 'Hide password' : 'Show password'}">
                        ${getEyeIconSvg(isPwVisible)}
                    </button>
                </div>
            </td>
            <td>
                <span class="${badgeClass}">${badgeLabel}</span>
            </td>
            <td>
                <div class="actions-cell">
                    <button type="button" class="btn-privileges" data-id="${acc.id}" title="Configure Access Privileges">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        <span>Privileges</span>
                    </button>
                    <button type="button" class="btn-action-icon edit-account-btn" data-id="${acc.id}" title="Edit Account">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button type="button" class="btn-action-icon btn-delete delete-account-btn" data-id="${acc.id}" title="Delete Account">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </td>
        `;

        // Wire event listeners on this row
        tr.querySelector('.toggle-email-btn').addEventListener('click', () => {
            visibleSecrets.email[acc.id] = !visibleSecrets.email[acc.id];
            renderAccountsTable();
        });

        tr.querySelector('.toggle-pw-btn').addEventListener('click', () => {
            visibleSecrets.password[acc.id] = !visibleSecrets.password[acc.id];
            renderAccountsTable();
        });

        tr.querySelector('.btn-privileges').addEventListener('click', () => {
            openPrivilegesModal(acc);
        });

        tr.querySelector('.edit-account-btn').addEventListener('click', () => {
            openAccountModal('edit', acc);
        });

        tr.querySelector('.delete-account-btn').addEventListener('click', () => {
            confirmDeleteAccount(acc);
        });

        tbody.appendChild(tr);
    });
}

function maskEmail(email) {
    if (!email) return '•••••••••••••';
    const atIdx = email.indexOf('@');
    if (atIdx === -1) return '•••••••••••••';
    // Show first 2 characters, dots, then domain
    const name = email.slice(0, atIdx);
    const domain = email.slice(atIdx);
    const visibleName = name.slice(0, Math.min(3, name.length));
    return `${visibleName}•••••${domain}`;
}

function getEyeIconSvg(isVisible) {
    if (isVisible) {
        // Eye-slash icon
        return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>`;
    } else {
        // Normal eye icon
        return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>`;
    }
}

// Account Modal Open / Close / Save
function openAccountModal(mode, account = null) {
    const modal = document.getElementById('account-form-modal-overlay');
    const titleEl = document.getElementById('account-modal-title');
    const emailInput = document.getElementById('modal-account-email');
    const pwInput = document.getElementById('modal-account-password');
    const roleSelect = document.getElementById('modal-account-role');
    const idInput = document.getElementById('modal-account-id');
    const submitBtn = document.getElementById('submit-account-modal-btn');

    if (mode === 'create') {
        titleEl.textContent = 'Add New Account';
        emailInput.value = '';
        emailInput.disabled = false;
        pwInput.value = '';
        pwInput.placeholder = 'Minimum 6 characters';
        roleSelect.value = 'committee';
        idInput.value = '';
        submitBtn.textContent = 'Create Account';
    } else {
        titleEl.textContent = 'Edit Account Credentials';
        emailInput.value = account.email || '';
        emailInput.disabled = false;
        pwInput.value = account.password || '';
        pwInput.placeholder = 'Enter new password or leave as-is';
        roleSelect.value = account.role || 'committee';
        idInput.value = account.id || '';
        submitBtn.textContent = 'Save Changes';
    }

    modal.classList.add('visible');
    setTimeout(() => emailInput.focus(), 150);
}

function closeAccountModal() {
    const modal = document.getElementById('account-form-modal-overlay');
    if (modal) modal.classList.remove('visible');
}

async function handleSaveAccount() {
    const emailInput = document.getElementById('modal-account-email');
    const pwInput = document.getElementById('modal-account-password');
    const roleSelect = document.getElementById('modal-account-role');
    const idInput = document.getElementById('modal-account-id');
    const submitBtn = document.getElementById('submit-account-modal-btn');

    const email = emailInput.value.trim();
    const password = pwInput.value.trim();
    const role = roleSelect.value;
    const userId = idInput.value;
    const isEdit = !!userId;

    if (!email) {
        showGenericModal('alert', 'Validation Error', 'Email address is required.');
        return;
    }
    if (!isEdit && (!password || password.length < 6)) {
        showGenericModal('alert', 'Validation Error', 'Password must be at least 6 characters long.');
        return;
    }
    if (isEdit && password && password !== '••••••••' && password.length < 6) {
        showGenericModal('alert', 'Validation Error', 'Password must be at least 6 characters long.');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
            throw new Error('Your session has expired. Please log in again.');
        }

        const payload = isEdit
            ? { action: 'update', userId, email, password, role }
            : { action: 'create', email, password, role };

        const res = await fetch('/api/accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionData.session.access_token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to save account.');
        }

        closeAccountModal();
        await loadAccounts();
        showGenericModal(
            'alert',
            'Success',
            `Account "<strong>${escapeHtml(email)}</strong>" ${isEdit ? 'updated' : 'created'} successfully!`
        );

    } catch (err) {
        console.error('Error saving account:', err);
        showGenericModal('alert', 'Error', 'Failed to save account: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Account';
    }
}

function confirmDeleteAccount(account) {
    const onConfirm = async () => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) {
                throw new Error('Your session has expired. Please log in again.');
            }

            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionData.session.access_token}`
                },
                body: JSON.stringify({ action: 'delete', userId: account.id })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete account.');
            }

            await loadAccounts();
            showGenericModal('alert', 'Deleted', `Account "<strong>${escapeHtml(account.email)}</strong>" has been deleted.`);

        } catch (err) {
            console.error('Error deleting account:', err);
            showGenericModal('alert', 'Error', 'Failed to delete account: ' + err.message);
        }
    };

    showGenericModal(
        'confirm',
        'Delete Account?',
        `Are you sure you want to delete account "<strong>${escapeHtml(account.email)}</strong>" (${escapeHtml(account.role)})? This action cannot be undone.`,
        onConfirm
    );
}

// Privileges Modal (Image #5 Spec)
function openPrivilegesModal(account) {
    currentPrivilegeTargetUser = account;
    const modal = document.getElementById('privileges-modal-overlay');
    const emailEl = document.getElementById('privileges-target-email');

    if (emailEl) emailEl.textContent = account.email;

    const userPrivs = Array.isArray(account.privileges) ? account.privileges : [];

    // Set checkboxes
    const checkCards = document.querySelectorAll('.privilege-card');
    checkCards.forEach(card => {
        const chk = card.querySelector('.priv-chk');
        if (chk) {
            const val = chk.value;
            chk.checked = userPrivs.includes(val);
            card.classList.toggle('checked', chk.checked);
        }
    });

    if (modal) modal.classList.add('visible');
}

function closePrivilegesModal() {
    const modal = document.getElementById('privileges-modal-overlay');
    if (modal) modal.classList.remove('visible');
    currentPrivilegeTargetUser = null;
}

async function handleSavePrivileges() {
    if (!currentPrivilegeTargetUser) return;

    const submitBtn = document.getElementById('submit-privileges-btn');
    const checkedPrivs = [];
    document.querySelectorAll('.priv-chk').forEach(chk => {
        if (chk.checked) checkedPrivs.push(chk.value);
    });

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
            throw new Error('Your session has expired. Please log in again.');
        }

        const res = await fetch('/api/accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionData.session.access_token}`
            },
            body: JSON.stringify({
                action: 'savePrivileges',
                userId: currentPrivilegeTargetUser.id,
                privileges: checkedPrivs
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update privileges.');
        }

        // Capture user info before closing modal (which resets currentPrivilegeTargetUser to null)
        const targetEmail = currentPrivilegeTargetUser?.email || 'User';
        const targetId = currentPrivilegeTargetUser?.id;

        // Update local state
        const targetAcc = accountsList.find(a => a.id === targetId);
        if (targetAcc) targetAcc.privileges = checkedPrivs;

        closePrivilegesModal();
        showGenericModal(
            'alert',
            'Privileges Saved',
            `Access privileges updated for "<strong>${escapeHtml(targetEmail)}</strong>".`
        );

    } catch (err) {
        console.error('Error saving privileges:', err);
        showGenericModal('alert', 'Error', 'Failed to save privileges: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Privileges';
    }
}

// --- 7. GENERIC MODAL LOGIC ------------------------
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
    if (modal) modal.classList.remove('visible');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}