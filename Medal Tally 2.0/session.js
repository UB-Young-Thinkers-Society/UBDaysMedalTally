async function checkSession(authorizedRole) {
    const { data: { user } } = await supabase.auth.getUser()
    if(!user){
        window.location.replace("index.html")
        console.log("Invalid session. Redirecting to login.");
        alert("Invalid session. Redirecting to login.")
    } else {
        const { data : userData, error : userError } = await supabase
            .from('user-roles')
            .select('*')
            .eq('user_id', user.id)
            .single();
          if (userData.roles != authorizedRole && userData.roles != "admin"){
            console.log("Access Forbidden. Redirecting.");
            alert("Access Forbidden. Redirecting to the " + userData.roles + " page.")
            if (userData.roles == "tabHead")
              window.location.replace("tabulation.html")
            else if (userData.roles == "committee")
              window.location.replace("computation.html")
          }
    }
}

//UNSAON PAG SERVER SIDE CHECK AUTH AND REDIRECT - beppu



supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session);
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  }
});