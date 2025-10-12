async function login(username, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
    email: username,
    password: password,
    }) 

    if (error) {
        alert('Error logging in. ' + error.message);
        console.error('Error logging in: ' + error.message);
    } else {
        alert('Welcome, ' + data.user.email + '!');
        console.log('User logged in: ' + data.session);
        window.location.href = 'tabulation-head.html' //add separate urls here for each role
    }
}

document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    login(username, password);
});
