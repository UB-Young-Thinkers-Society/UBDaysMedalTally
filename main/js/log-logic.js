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
        
        // Build the correct navbar
        buildNavbar(role);

        // --- UPDATED LOGIC/COMMENT ---
        // Only authorizedRole (e.g., "tabHead") and "admin" can see this page
        if (role !== authorizedRole && role !== "admin") {
            console.log("Access Forbidden. Redirecting.");
            // Redirect "committee" to their own page, all others to login
            if (role === "committee") window.location.replace("computation.html");
            else window.location.replace("login.html");
        }
    } catch (error) {
        console.error('Error checking session:', error);
        window.location.replace("login.html");
    }
}

function buildNavbar(role) {
    const navContainer = document.getElementById('navButtons');
    if (!navContainer) return;
    let navHTML = '';
    if (role === 'admin' || role === 'tabHead') {
        navHTML = `
            <a href="tabulation.html" class="nav-btn">Events</a>
            <a href="config.html" class="nav-btn">Config</a>
            <a href="log.html" class="nav-btn active">Log</a>
            <a href="about-us.html" class="nav-btn">About Us</a>
        `;
    } 
    // NOTE: This intentionally leaves the nav blank for any other role
    // (like 'committee') that might land here before being redirected.
    navContainer.innerHTML = navHTML;
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error logging out:" + error.message);
    else window.location.href = 'login.html';
}

// --- 2. PAGE INITIALIZATION ------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // --- UPDATED COMMENT ---
    // Check for "tabHead" or "admin".
    // "committee" will be redirected by this function.
    await checkSession("tabHead"); 
    
    // Load the logs
    await loadLogs();

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });

    const loader = document.getElementById('loader');
    loader.classList.add('hide');
    setTimeout(() => { loader.style.display = 'none'; }, 600);
});

// --- 3. LOG LOADING -------------------------------
async function loadLogs() {
    const container = document.getElementById('log-container');
    
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('Session expired.');

        // Call our merged API with the new 'getLogs' type
        const response = await fetch('/api/data?type=getLogs', {
            headers: { 'Authorization': `Bearer ${sessionData.session.access_token}` }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to fetch logs');
        }

        const logs = await response.json();
        container.innerHTML = ''; // Clear loading message

        if (logs.length === 0) {
            container.innerHTML = '<div class="log-item">No activities recorded yet.</div>';
            return;
        }

        // Format the date/time
        const options = {
            year: '2-digit', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: true
        };

        // --- UPDATED to display email ---
        logs.forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = 'log-item';
            
            const timestamp = new Date(log.created_at).toLocaleString('en-US', options);
            
            // This now includes the 'log.user_email' from our API
            logItem.innerHTML = `
                <span class="log-timestamp">${timestamp}</span>
                <span class="log-details">${log.details}</span>
                <span class="log-user">By: ${log.user_email}</span>
            `;
            container.appendChild(logItem);
        });

    } catch (error) {
        console.error('Error loading logs:', error);
        container.innerHTML = `<div class="log-item" style="color: red;">Error: ${error.message}</div>`;
    }
}