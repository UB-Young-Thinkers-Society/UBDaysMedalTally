async function login(username, password) {
    const { data : loginData, error : loginError } = await supabase.auth.signInWithPassword({
    email: username,
    password: password,
    }) 
    if (loginError) {
        alert('Error logging in. ' + loginError.message);
        console.error('Error logging in: ' + loginError.message);
    } else {
        alert('Welcome, ' + data.user.email + '!');
        console.log('User logged in: ' + data.session);
        window.location.href = 'tabulation.html' //add separate urls here for each role
    }
}

async function checkIfLoggedIn() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data : userData, error : userError } = await supabase
            .from('user-roles')
            .select('*')
            .eq('user_id', user.id)
            .single(); //is there a way to clean this up and merge it with the stuff above?
    if(user){
        console.log("Already Logged In. Redirecting to login.");
        if (userData.roles == "admin") //temporary - add a page for admins?
            window.location.replace("tabulation.html")
        else if (userData.roles == "tabHead")
            window.location.replace("tabulation.html")
        else if (userData.roles == "committee")
            window.location.replace("computation.html")
        else {
            alert('Error Redirecting. ' + userError);
            console.error('Error Redirecting: ' + userError);
        }
    }
}

checkIfLoggedIn()
    
// }

document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    login(username, password);
});
