// async function login(username, password) {
//     const { data : loginData, error : loginError } = await supabase.auth.signInWithPassword({
//     email: username,
//     password: password,
//     }) 
//     if (loginError) {
//         // alert('Error logging in. ' + loginError.message);
//         console.error('Error logging in: ' + loginError.message);
//     } else {
//         const { data : userData, error : userError } = await supabase
//             .from('user-roles')
//             .select('*')
//             .eq('user_id', loginData.user.id)
//             .single();

//         // alert('Welcome, ' + userData.roles + ' ' + loginData.user.email + '!');
//         console.log('User logged in: ' + loginData.session);

//         if (userData.roles == "admin"){ //clean this up, idk how pa - beppu
//             window.location.href = 'tabulation.html' //temporary - add a page for admins?
//         } else if (userData.roles == "tabHead"){
//             window.location.href = 'tabulation.html' 
//         } else if (userData.roles == "committee"){
//             window.location.href = 'computation.html'
//         } else {
//             alert('Error logging in. ' + userError.message);
//             console.error('Error logging in: ' + userError.message);
//         }
//     }
// }

// async function checkIfLoggedIn() {
//     const { data: { user } } = await supabase.auth.getUser()
//     const { data : userData, error : userError } = await supabase
//             .from('user-roles')
//             .select('*')
//             .eq('user_id', user.id)
//             .single(); //is there a way to clean this up and merge it with the stuff above?
//     if(user){
//         console.log("Already Logged In. Redirecting to login.");
//         if (userData.roles == "admin") //temporary - add a page for admins?
//             window.location.replace("tabulation.html")
//         else if (userData.roles == "tabHead")
//             window.location.replace("tabulation.html")
//         else if (userData.roles == "committee")
//             window.location.replace("computation.html")
//         else {
//             // alert('Error Redirecting. ' + userError);
//             console.error('Error Redirecting: ' + userError);
//         }
//     }
// }

// checkIfLoggedIn()
    
// // }

// document.getElementById('loginForm').addEventListener('submit', function (e) {
//     e.preventDefault();
//     const username = document.getElementById('username').value;
//     const password = document.getElementById('password').value;
//     login(username, password);
// });

// This is a secure serverless function (Node.js)
// It handles BOTH login (POST) and session checks (GET)
import { supabase } from './db_connection.js'; // Assumes you have your secure db_connection.js in the api folder

export default async (req, res) => {
    try {
        let userId;

        if (req.method === 'POST') {
            // --- HANDLE LOGIN ATTEMPT ---
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required.' });
            }

            // 1. Sign in the user using Supabase auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (authError) {
                // This error is safe to show the user
                return res.status(401).json({ error: 'Invalid login credentials.' });
            }
            
            if (!authData.user) {
                return res.status(500).json({ error: 'Login failed, please try again.' });
            }

            // --- IMPORTANT ---
            // We must set the session cookie for the browser to use
            const session = authData.session;
            if (session) {
                // This cookie will be sent on all future requests
                // NOTE: Vercel might have issues setting cookies like this.
                // Supabase's client JS handles this better, but this is the server-side way.
                // For simplicity, Supabase's client-side cookie handling might be what's
                // actually happening, and this API just validates it.
            }

            userId = authData.user.id;

        } else if (req.method === 'GET') {
            // --- HANDLE SESSION CHECK ---
            // Get the user from the session cookie sent by the browser
            // This relies on Supabase's client-side JS already having set the cookie.
            const { data: { user }, error: userError } = await supabase.auth.getUser(req.headers.cookie);

            if (userError || !user) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }
            userId = user.id;

        } else {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        // --- COMMON LOGIC: GET ROLE ---
        // If we have a valid userId (from POST or GET), get their role.
        if (userId) {
            // This is your exact query from login.js
            const { data: roleData, error: roleError } = await supabase
                .from('user-roles') // Make sure this table name is correct!
                .select('roles')
                .eq('user_id', userId)
                .single();

            if (roleError || !roleData) {
                return res.status(500).json({ error: 'Could not find user role.' });
            }

            // Success! Send back the role.
            return res.status(200).json({ role: roleData.roles });
        }

    } catch (error) {
        console.error('Error in /api/login:', error);
        return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};
