// --- 1. RUNS ON PAGE LOAD ------------------------
document.addEventListener('DOMContentLoaded', () => {
    checkActiveSession();
    
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);
});

async function checkActiveSession() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
        console.log('No active session found.');
        return;
    }

    const accessToken = sessionData.session.access_token;

    try {
        const response = await fetch('/api/login', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            console.error('Session check failed, staying on login page.');
            await supabase.auth.signOut(); 
            return;
        }

        const { role } = await response.json();
        redirectToRole(role);

    } catch (error) {
        console.error('Error checking active session:', error);
    }
}

async function handleLogin(e) {
    e.preventDefault(); 

    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');

    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    errorMessage.textContent = '';

    try {
        // --- STEP 1: LOGIN ON THE CLIENT ---
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (authError) {
            throw authError;
        }

        // --- STEP 2: GET THE ROLE FROM THE SECURE API ---
        const accessToken = authData.session.access_token;

        const response = await fetch('/api/login', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Login successful, but failed to get user role.');
        }
        
        const { role } = await response.json();

        // --- STEP 3: REDIRECT ---
        redirectToRole(role);

    } catch (error) {
        errorMessage.textContent = error.message;
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
}

// --- 4. REDIRECT HELPER FUNCTION ------------------
function redirectToRole(role) {
    if (role === 'admin' || role === 'tabHead') {
        window.location.replace('tabulation.html'); 
    } else if (role === 'committee') {
        window.location.replace('computation.html');
    } else {
        console.error('Unknown role, redirecting to login.');
        const errorMessage = document.getElementById('error-message');
        if(errorMessage) errorMessage.textContent = 'Unknown user role assigned.';
    }
}

// --- 5. LOGOUT FUNCTION (from your logout.js) ---
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error logging out:" + error.message);
    } else {
        console.log("Successfully logged out.");
        window.location.href = 'login.html';
    }
}