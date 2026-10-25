// --- 1. AUTHENTICATION & SESSION -------------------

/**
 * Signs the user out safely and redirects to login.html.
 */
async function signOut() {
    try {
        const client = window.supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
        if (client && client.auth && typeof client.auth.signOut === 'function') {
            await client.auth.signOut();
        }
    } catch (error) {
        console.error("Error logging out:", error);
    }
    window.location.href = 'login.html';
}

/**
 * Dynamically builds the nav buttons based on user role.
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
        case 'visitor':
        default:
            // Public visitor or unauthenticated user
            navHTML = `
                <a href="index.html" class="nav-btn">Live</a>
                <a href="about-us.html" class="nav-btn active">About Us</a>
            `;
            break;
    }
    
    navContainer.innerHTML = navHTML;
}

/**
 * Checks session and role conditionally:
 * - If user is not logged in (visitor), allows access, shows "Live" nav link, and hides Log Out button.
 * - If user is logged in (admin, tabHead, committee), shows appropriate nav links and the Log Out button.
 */
async function checkSession() {
    const logoutBtn = document.getElementById('logoutBtn');
    const client = window.supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);

    if (!client || !client.auth) {
        // Fallback to visitor view if supabase client is not loaded
        if (logoutBtn) logoutBtn.style.display = 'none';
        buildNavbar('visitor');
        return;
    }

    try {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();

        if (sessionError || !sessionData || !sessionData.session) {
            // Not logged in -> Visitor mode (accessible by anyone)
            if (logoutBtn) logoutBtn.style.display = 'none';
            buildNavbar('visitor');
            return;
        }

        const accessToken = sessionData.session.access_token;
        let role = null;

        // Try getting role via backend API
        try {
            const response = await fetch('/api/auth', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                role = data.role;
            }
        } catch (apiErr) {
            console.warn('API /api/auth failed, attempting direct DB query:', apiErr);
        }

        // Direct fallback to user-roles table if API was unreachable
        if (!role) {
            try {
                const { data: roleData } = await client
                    .from('user-roles')
                    .select('roles')
                    .eq('user_id', sessionData.session.user.id)
                    .maybeSingle();
                if (roleData && roleData.roles) {
                    role = roleData.roles;
                }
            } catch (dbErr) {
                console.error('Role fallback error:', dbErr);
            }
        }

        if (role === 'admin' || role === 'tabHead' || role === 'committee') {
            if (logoutBtn) logoutBtn.style.display = 'block';
            buildNavbar(role);
        } else {
            // Unknown role or invalid token
            if (logoutBtn) logoutBtn.style.display = 'none';
            buildNavbar('visitor');
        }

    } catch (error) {
        console.error('Error checking session on about-us page:', error);
        if (logoutBtn) logoutBtn.style.display = 'none';
        buildNavbar('visitor');
    }
}


// --- 2. PAGE INITIALIZATION -----------------

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Immediately attach logout listener so it always responds to clicks
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut();
        });
    }

    // 2. Check session & conditionally show/hide role features
    await checkSession();

    // 3. Handle loader
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hide');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 600);
    }

    // 4. Animate developer cards
    const cards = document.querySelectorAll('.developer-card');
    if (cards.length > 0 && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        cards.forEach(card => observer.observe(card));
    } else {
        cards.forEach(card => card.classList.add('visible'));
    }

    // 5. Handle tech card "learn more"
    document.querySelectorAll('.tech-card').forEach(card => {
        const btn = card.querySelector('.tech-toggle');
        if (btn) {
            btn.addEventListener('click', function () {
                card.classList.toggle('expanded');
            });
        }
    });
});