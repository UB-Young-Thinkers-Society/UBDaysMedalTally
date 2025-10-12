async function signOut() {
    const { error } = await supabase.auth.signOut()
    if(error){
        alert("Error logging out.")
        console.error("Error logging out:" + error.message)
    } else {
        alert("Successfully logged out.")
        console.log("Successfully logged out.")
        window.location.href = 'index.html';
    }
}



