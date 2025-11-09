// --- 1. AUTHENTICATION & SESSION -------------------
async function checkSession(authorizedRole) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.replace("login.html");
        console.log("Invalid session. Redirecting to login.");
    } else {
        const { data: userData, error: userError } = await supabase
            .from('user-roles')
            .select('roles')
            .eq('user_id', user.id)
            .single();
        
        if (userError) {
            console.error("Error fetching user role:", userError);
            return;
        }

        if (userData.roles !== authorizedRole && userData.roles !== "admin") {
            console.log("Access Forbidden. Redirecting.");
            if (userData.roles === "tabHead")
              window.location.replace("tabulation.html");
            else if (userData.roles === "committee")
              window.location.replace("computation.html");
        }
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

    loadCategories();
    loadTeams();

    addTeamForm.addEventListener('submit', handleAddTeam);
    addEventForm.addEventListener('submit', handleAddEvent);
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
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
        const response = await fetch('/api/get-categories');
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
        const response = await fetch('/api/get-teams');
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
            
            // This is the same display logic from your display_team.js
            departmentDiv.innerHTML = `
                <div class="dept-logo-placeholder">
                    <img src="${team.logo_url}" alt="${team.acronym} Logo" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <span class="dept-name">${team.acronym}</span>
                <button class="edit-btn" data-id="${team.id}">Edit</button>
                <button class="delete-btn" data-id="${team.id}">Delete</button>
            `;
            departmentList.appendChild(departmentDiv);
            
        });

    } catch (error) {
        console.error(error);
        departmentList.innerHTML = "<p>Failed to load teams.</p>";
    }
}

// --- 4. FORM HANDLERS (CALLING APIs) ----------------
async function handleAddTeam(e) {
    e.preventDefault(); // Stop form from reloading page
    
    const nameInput = document.getElementById('team-name');
    const acronymInput = document.getElementById('team-acronym');
    const logoInput = document.getElementById('add-logo');
    
    const formData = new FormData();
    formData.append('name', nameInput.value.trim());
    formData.append('acronym', acronymInput.value.trim());
    formData.append('logoFile', logoInput.files[0]);

    try {
        const response = await fetch('/api/add-team', {
            method: 'POST',
            body: formData, 
        });

        if (!response.ok) {
            let errorText = `Error ${response.status}: `;
            const text = await response.text();
            try {
                const err = JSON.parse(text);
                errorText += err.error || 'Server error';
            } catch (jsonError) {
                errorText += text || 'Unknown server error';
            }
            throw new Error(errorText);
        }

        alert('Team added successfully!');
        location.reload(); 

    } catch (error) {
        console.error('Error adding team:', error);
        alert('Error adding team: ' + error.message);
    }
}

async function handleAddEvent(e) {
    e.preventDefault(); 
    const eventNameInput = document.getElementById('event-name');
    const eventCategorySelect = document.getElementById('event-category');
    const eventMedalInput = document.getElementById('event-medal');

    const eventData = {
        name: eventNameInput.value.trim(),
        category_id: eventCategorySelect.value,
        medal_value: parseInt(eventMedalInput.value),
    };

    try {
        const response = await fetch('/api/add-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData),
        });

        if (!response.ok) {
            let errorText = `Error ${response.status}: `;
            const text = await response.text();
            try {
                const err = JSON.parse(text);
                errorText += err.error || 'Server error';
            } catch (jsonError) {
                errorText += text || 'Unknown server error';
            }
            throw new Error(errorText);
        }

        alert('Event added successfully!');
        eventNameInput.value = '';
        eventCategorySelect.value = '';
        eventMedalInput.value = '';

    } catch (error) {
        console.error('Error adding event:', error);
        alert('Error adding event: ' + error.message);
    }
}