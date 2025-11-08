// This script runs on the client-side (in the browser)
// It handles both auto-redirects and login form submission.

// --- 1. RUNS ON PAGE LOAD ------------------------
document.addEventListener('DOMContentLoaded', () => {
    checkActiveSession();
    
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);
});

// --- 2. CHECK IF USER IS ALREADY LOGGED IN --------
async function checkActiveSession() {
    // This function replaces your checkIfLoggedIn()
    // It checks with Supabase if a user session *in the browser* already exists
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        // User is logged in. We need to get their role from our secure API.
        // We don't need to send credentials; the session cookie is sent automatically.
        try {
            const response = await fetch('/api/login', {
                method: 'GET', // A GET request to check the session
            });
            
            if (!response.ok) {
                // If the API fails (e.g., session expired), just stay on the login page
                console.error('Session check failed, staying on login page.');
                return;
            }

            const { role } = await response.json();
            redirectToRole(role);

        } catch (error) {
            console.error('Error checking active session:', error);
        }
    }
}

// --- 3. HANDLE THE LOGIN FORM SUBMISSION ----------
async function handleLogin(e) {
    e.preventDefault(); // Stop the form from reloading the page

    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');

    // Disable button and show loading
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    errorMessage.textContent = '';

    try {
        // Send the email and password to our NEW secure API endpoint
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            // If the server returns an error (like "Invalid login"), display it
            throw new Error(data.error || 'Login failed.');
        }

        // --- SUCCESS ---
        // The API was successful. It returned a role. Redirect.
        redirectToRole(data.role);

    } catch (error) {
        errorMessage.textContent = error.message;
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
}

// --- 4. REDIRECT HELPER FUNCTION ------------------
// This is your exact redirect logic
function redirectToRole(role) {
    if (role === 'admin' || role === 'tabHead') {
        window.location.replace('tabulation.html'); // Main page for these roles
    } else if (role === 'committee') {
        window.location.replace('computation.html');
    } else {
        // Fallback or for other roles
        console.error('Unknown role, redirecting to login.');
        const errorMessage = document.getElementById('error-message');
        if(errorMessage) errorMessage.textContent = 'Unknown user role assigned.';
    }
}

// --- 5. LOGOUT FUNCTION (from your logout.js) ---
// You can call this from a 'logout' button on your other pages
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error logging out:" + error.message);
    } else {
        console.log("Successfully logged out.");
        window.location.href = 'index.html';
    }
}