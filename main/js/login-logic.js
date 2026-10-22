const SUPABASE_URL = "https://nmftggrzxxkvpepqywmm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZnRnZ3J6eHhrdnBlcHF5d21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNDkzNzYsImV4cCI6MjA3NTcyNTM3Nn0.Y-BXGIQ0r_HqLZAvU8RSpZwOa3Rtvvjlp0xzbeARTto";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 1. RUNS ON PAGE LOAD ------------------------
document.addEventListener('DOMContentLoaded', () => {
    checkActiveSession();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    setupPasswordToggle();
    setupInputClearError();
});

/**
 * Sets up the password visibility toggle button.
 */
function setupPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (!toggleBtn || !passwordInput) return;

    toggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

        const eyeOpen = toggleBtn.querySelector('.eye-open');
        const eyeClosed = toggleBtn.querySelector('.eye-closed');

        if (eyeOpen && eyeClosed) {
            eyeOpen.style.display = isPassword ? 'none' : 'block';
            eyeClosed.style.display = isPassword ? 'block' : 'none';
        }

        toggleBtn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
    });
}

/**
 * Removes error state as soon as the user edits the input.
 */
function setupInputClearError() {
    const emailInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorBox = document.getElementById('error-message');

    [emailInput, passwordInput].forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            if (errorBox) {
                errorBox.style.display = 'none';
                errorBox.textContent = '';
            }
        });
    });
}

/**
 * Automatically redirects if a valid session and role already exist.
 */
async function checkActiveSession() {
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData || !sessionData.session) {
            return;
        }

        const accessToken = sessionData.session.access_token;
        const role = await getUserRole(sessionData.session, accessToken);

        if (!role) {
            console.warn('Existing session has no role assigned, signing out.');
            await supabase.auth.signOut(); 
            return;
        }

        redirectToRole(role);
    } catch (error) {
        console.error('Error checking active session:', error);
    }
}

/**
 * Retrieves the user role via /api/auth with direct Supabase fallback.
 */
async function getUserRole(session, accessToken) {
    try {
        const response = await fetch('/api/auth', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            if (data && data.role) return data.role;
        }
    } catch (_) {}

    try {
        const userId = session.user.id;
        const { data } = await supabase
            .from('user-roles')
            .select('roles')
            .eq('user_id', userId)
            .maybeSingle();
        if (data && data.roles) {
            return data.roles;
        }
    } catch (e) {
        console.error('Direct role fallback error:', e);
    }
    return null;
}

/**
 * Handles the login form submission.
 */
async function handleLogin(e) {
    e.preventDefault(); 

    const emailInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');
    const btnSpinner = loginButton.querySelector('.btn-spinner');
    const btnText = loginButton.querySelector('.btn-text');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Reset previous errors
    emailInput.classList.remove('input-error');
    passwordInput.classList.remove('input-error');
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';

    if (!email || !password) {
        showError('Please enter both your email and password.');
        if (!email) emailInput.classList.add('input-error');
        if (!password) passwordInput.classList.add('input-error');
        return;
    }

    // Set loading state
    loginButton.disabled = true;
    if (btnSpinner) btnSpinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Logging in...';

    try {
        // --- STEP 1: LOGIN ON CLIENT WITH SUPABASE ---
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (authError) {
            throw authError;
        }

        if (!authData || !authData.session) {
            throw new Error('No active session returned from Supabase.');
        }

        // --- STEP 2: VERIFY ROLE (API with Supabase fallback) ---
        const accessToken = authData.session.access_token;
        const role = await getUserRole(authData.session, accessToken);

        if (!role) {
            throw new Error('Login was authenticated, but no valid role is assigned to this account.');
        }

        // --- STEP 3: REDIRECT TO DESIGNATED WORKSPACE ---
        redirectToRole(role);

    } catch (error) {
        console.error('Login error:', error);
        
        let friendlyMessage = error.message || 'An unexpected error occurred. Please try again.';
        if (friendlyMessage.toLowerCase().includes('invalid login credentials')) {
            friendlyMessage = 'Invalid email or password. Please verify your credentials.';
            emailInput.classList.add('input-error');
            passwordInput.classList.add('input-error');
        } else if (friendlyMessage.toLowerCase().includes('failed to fetch')) {
            friendlyMessage = 'Network connection error. Please check your internet connection.';
        }

        showError(friendlyMessage);

        // Reset button state
        loginButton.disabled = false;
        if (btnSpinner) btnSpinner.style.display = 'none';
        if (btnText) btnText.textContent = 'Login';
    }
}

/**
 * Displays error message in the alert container.
 */
function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
}

/**
 * Redirects the user to the proper page based on their role.
 */
function redirectToRole(role) {
    if (role === 'admin' || role === 'tabHead') {
        window.location.replace('tabulation.html'); 
    } else if (role === 'committee') {
        window.location.replace('computation.html');
    } else {
        console.error('Unknown role assigned:', role);
        showError('Your account does not have a valid role assigned. Please contact the administrator.');
        const loginButton = document.getElementById('login-button');
        if (loginButton) {
            loginButton.disabled = false;
            const btnSpinner = loginButton.querySelector('.btn-spinner');
            const btnText = loginButton.querySelector('.btn-text');
            if (btnSpinner) btnSpinner.style.display = 'none';
            if (btnText) btnText.textContent = 'Login';
        }
    }
}

/**
 * Logs out the active user session.
 */
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error logging out:", error.message);
    } else {
        console.log("Successfully logged out.");
        window.location.href = 'login.html';
    }
}