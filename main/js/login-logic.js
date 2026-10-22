// =======================================================
// UBDays Medal Tally - Login Logic (Isolated IIFE Scope)
// =======================================================

(function () {
    'use strict';

    const SUPABASE_URL = "https://nmftggrzxxkvpepqywmm.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZnRnZ3J6eHhrdnBlcHF5d21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNDkzNzYsImV4cCI6MjA3NTcyNTM3Nn0.Y-BXGIQ0r_HqLZAvU8RSpZwOa3Rtvvjlp0xzbeARTto";

    let sbClient = null;

    // Surface any runtime errors directly on the page for instant debugging
    window.addEventListener('error', function (event) {
        console.error('[Login Error]', event);
        showError('Browser script error: ' + (event.message || 'Unknown error'), {
            filename: event.filename,
            line: event.lineno,
            col: event.colno
        });
    });

    document.addEventListener('DOMContentLoaded', function () {
        console.log('[Login] DOM loaded. Initializing Supabase client...');

        // Initialize client from global window.supabase (provided by unpkg script)
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('[Login] Supabase client created successfully.');
        } else {
            console.error('[Login] window.supabase is not available.');
            showError('Authentication library (Supabase) failed to load. Please check your network or ad-blocker.', {
                cdn: 'https://unpkg.com/@supabase/supabase-js@2'
            });
            return;
        }

        checkActiveSession();

        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        setupPasswordToggle();
        setupInputClearError();
    });

    function setupPasswordToggle() {
        const toggleBtn = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');
        if (!toggleBtn || !passwordInput) return;

        toggleBtn.addEventListener('click', function () {
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

    function setupInputClearError() {
        const emailInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const errorBox = document.getElementById('error-message');

        [emailInput, passwordInput].forEach(function (input) {
            if (!input) return;
            input.addEventListener('input', function () {
                input.classList.remove('input-error');
                if (errorBox) {
                    errorBox.style.display = 'none';
                    errorBox.innerHTML = '';
                }
            });
        });
    }

    async function checkActiveSession() {
        if (!sbClient) return;
        try {
            const { data: sessionData, error: sessionError } = await sbClient.auth.getSession();

            if (sessionError || !sessionData || !sessionData.session) {
                console.log('[Login] No active session found.');
                return;
            }

            console.log('[Login] Active session found for:', sessionData.session.user.email);
            const accessToken = sessionData.session.access_token;
            const role = await getUserRole(sessionData.session, accessToken);

            if (!role) {
                console.warn('[Login] Session exists but no role found. Signing out...');
                await sbClient.auth.signOut();
                return;
            }

            console.log('[Login] Redirecting user with role:', role);
            redirectToRole(role);
        } catch (error) {
            console.error('[Login] Error during session check:', error);
        }
    }

    async function getUserRole(session, accessToken) {
        // 1. Try serverless backend API (/api/auth)
        try {
            const response = await fetch('/api/auth', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + accessToken }
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.role) {
                    console.log('[Login] Role confirmed via /api/auth:', data.role);
                    return data.role;
                }
            } else {
                console.warn('[Login] /api/auth responded with status:', response.status);
            }
        } catch (apiErr) {
            console.warn('[Login] /api/auth unreachable (normal for local static server):', apiErr.message);
        }

        // 2. Direct Supabase fallback
        try {
            const userId = session.user.id;
            const { data, error } = await sbClient
                .from('user-roles')
                .select('roles')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error('[Login] Direct user-roles query error:', error);
            } else if (data && data.roles) {
                console.log('[Login] Role confirmed via Supabase table:', data.roles);
                return data.roles;
            }
        } catch (e) {
            console.error('[Login] Direct role fallback exception:', e);
        }
        return null;
    }

    async function handleLogin(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        const emailInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('login-button');
        const errorMessage = document.getElementById('error-message');
        const btnSpinner = loginButton ? loginButton.querySelector('.btn-spinner') : null;
        const btnText = loginButton ? loginButton.querySelector('.btn-text') : null;

        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        // Reset state
        if (emailInput) emailInput.classList.remove('input-error');
        if (passwordInput) passwordInput.classList.remove('input-error');
        if (errorMessage) {
            errorMessage.style.display = 'none';
            errorMessage.innerHTML = '';
        }

        if (!email || !password) {
            showError('Please enter both your email address and password.');
            if (!email && emailInput) emailInput.classList.add('input-error');
            if (!password && passwordInput) passwordInput.classList.add('input-error');
            return;
        }

        if (!sbClient) {
            showError('Authentication service is not ready. Please refresh the page.');
            return;
        }

        // UI Loading State
        if (loginButton) loginButton.disabled = true;
        if (btnSpinner) btnSpinner.style.display = 'inline-block';
        if (btnText) btnText.textContent = 'Logging in...';

        try {
            console.log('[Login] Signing in user:', email);

            // Step 1: Supabase client login
            const { data: authData, error: authError } = await sbClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (authError) {
                throw authError;
            }

            if (!authData || !authData.session) {
                throw new Error('Supabase did not return an active session token.');
            }

            console.log('[Login] Supabase authenticated. Resolving role...');

            // Step 2: Resolve Role
            const accessToken = authData.session.access_token;
            const role = await getUserRole(authData.session, accessToken);

            if (!role) {
                throw new Error('Authenticated successfully, but no workspace role is assigned to "' + email + '" in the database.');
            }

            console.log('[Login] Role confirmed:', role, '- redirecting to workspace...');
            redirectToRole(role);

        } catch (error) {
            console.error('[Login] Error:', error);

            let friendly = error.message || 'An unexpected error occurred. Please try again.';
            if (friendly.toLowerCase().includes('invalid login credentials')) {
                friendly = 'Invalid email or password. Please verify your credentials.';
                if (emailInput) emailInput.classList.add('input-error');
                if (passwordInput) passwordInput.classList.add('input-error');
            } else if (friendly.toLowerCase().includes('failed to fetch')) {
                friendly = 'Network connection error. Unable to reach authentication server.';
            }

            showError(friendly, {
                error: error.name || 'AuthError',
                message: error.message || String(error),
                code: error.status || error.code || 'UNKNOWN',
                timestamp: new Date().toLocaleTimeString()
            });

            // Reset button
            if (loginButton) loginButton.disabled = false;
            if (btnSpinner) btnSpinner.style.display = 'none';
            if (btnText) btnText.textContent = 'Login';
        }
    }

    function showError(message, debugDetail) {
        const errorBox = document.getElementById('error-message');
        if (!errorBox) {
            alert(message);
            return;
        }

        let html = '<div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 6px;">' +
            '<span>⚠️</span><span>Login Notice</span></div>' +
            '<div style="margin-bottom: 6px;">' + escapeHtml(message) + '</div>';

        if (debugDetail) {
            const detailStr = typeof debugDetail === 'object'
                ? JSON.stringify(debugDetail, null, 2)
                : String(debugDetail);

            html += '<details style="margin-top: 8px; text-align: left; font-size: 0.8rem; border-top: 1px solid #fca5a5; padding-top: 6px;">' +
                '<summary style="cursor: pointer; color: #991b1b; font-weight: 600;">Technical Debug Details (Click to view)</summary>' +
                '<pre style="background: rgba(0,0,0,0.06); padding: 8px; border-radius: 6px; overflow-x: auto; margin-top: 4px; font-family: monospace; white-space: pre-wrap; word-break: break-all;">' +
                escapeHtml(detailStr) + '</pre></details>';
        }

        errorBox.innerHTML = html;
        errorBox.style.display = 'block';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    }

    function redirectToRole(role) {
        if (role === 'admin' || role === 'tabHead') {
            window.location.replace('tabulation.html');
        } else if (role === 'committee') {
            window.location.replace('computation.html');
        } else {
            console.error('[Login] Unknown role:', role);
            showError('Account has unrecognized role: ' + role);
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
})();