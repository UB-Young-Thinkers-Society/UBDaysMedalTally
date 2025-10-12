async function checkSession() {
    const { data: { user } } = await supabase.auth.getUser()
    if(!user){
        window.location.href = 'index.html'
        console.log("Invalid session. Redirecting to login.");
        alert("Invalid session. Redirecting to login.")
    }
}
//so far the above only checks if valid ang session, maybe i convert 
//nalang ni to inline js for every page and specify which roles ang pwede mu access
//once ma integrate ang roles sa auth users? - beppu

checkSession()

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session);
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  }
});