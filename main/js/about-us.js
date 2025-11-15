// --- 1. AUTHENTICATION & SESSION (NEW) -------------------

/**
 * Securely checks the user's session and role.
 */
async function checkSession() {
    // 1. Get the session from the browser
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
        // No one is logged in, redirect to login
        window.location.replace("login.html");
        return;
    }

    const accessToken = sessionData.session.access_token;

    try {
        // 2. Securely get the user's role from our API
        const response = await fetch('/api/auth', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            // If the token is bad, sign out and redirect
            await supabase.auth.signOut(); 
            window.location.replace("login.html");
            return;
        }

        const { role } = await response.json();
        
        // 3. (NEW) Build the navbar based on the role
        buildNavbar(role);
        
        console.log("Session valid, user authorized: " + role);

    } catch (error) {
        console.error('Error checking session:', error);
        window.location.replace("login.html");
    }
}

/**
 * (NEW) Dynamically builds the nav buttons based on user role.
 */
function buildNavbar(role) {
    const navContainer = document.querySelector('.navButtons');
    if (!navContainer) {
        console.error("Navigation container '.navButtons' not found.");
        return;
    }

    let navHTML = '';

    switch (role) {
        case 'admin':
        case 'tabHead':
            // Admin/TabHead gets the full navigation
            navHTML = `
                <a href="tabulation.html" class="nav-btn">Events</a>
                <a href="config.html" class="nav-btn">Config</a>
                <a href="log.html" class="nav-btn">Log</a>
                <a href="about-us.html" class="nav-btn active">About Us</a>
            `;
            break;
        case 'committee':
            // Committee gets their specific navigation
            navHTML = `
                <a href="computation.html" class="nav-btn">Computation</a>
                <a href="about-us.html" class="nav-btn active">About Us</a>
            `;
            break;
        default:
            // Fallback for unknown roles (or just show 'About Us')
            navHTML = `
                <a href="about-us.html" class="nav-btn active">About Us</a>
            `;
    }
    
    navContainer.innerHTML = navHTML;
}

/**
 * (NEW) Signs the user out.
 */
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error logging out:" + error.message);
    } else {
        console.log("Successfully logged out.");
        window.location.href = 'login.html';
    }
}


// --- 2. PAGE INITIALIZATION (MODIFIED) -----------------

// We wrap all page logic in one 'DOMContentLoaded' listener
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. (NEW) Check session and build navbar first
    // This function will also handle redirecting if no session exists.
    await checkSession();

    // 2. (NEW) Attach logout listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = function (e) {
            e.preventDefault();
            signOut();
        };
    }
    
    // 3. (Original logic) Handle loader
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hide');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 600);
    }

    // 4. (Original logic) Animate developer cards
    const cards = document.querySelectorAll('.developer-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    cards.forEach(card => observer.observe(card));

    // 5. (Original logic) Handle tech card "learn more"
    document.querySelectorAll('.tech-card').forEach(card => {
        const btn = card.querySelector('.tech-toggle');
        if (btn) {
            btn.addEventListener('click', function () {
                card.classList.toggle('expanded');
            });
        }
    });
});