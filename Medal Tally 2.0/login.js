async function login(username, password) {
    const { data, error } = await supabase
        .from('test_user')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error || !data) {
        alert(' Invalid username or password');
    } else {
        alert('Welcome, ' + data.username + '!');
        window.location.href = 'tabulation-head.html';
    }
}

document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    login(username, password);
});