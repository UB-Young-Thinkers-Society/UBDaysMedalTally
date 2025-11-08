document.addEventListener("DOMContentLoaded", async () => {
    // Athletics function call
    const athleticSection = document.querySelector("#athletics-details");
    if (athleticSection) {
        if (typeof loadAthleticEvents === "function") {
            await loadAthleticEvents();
        } 
    }

    //Music Category function call
    const musicSection = document.querySelector("#music-details");
    if (musicSection) {
        if (typeof loadMusicEvents === "function") {
            await loadMusicEvents();
        } 
    }

    // Dances function call
    const danceSection = document.querySelector("#dances-details");
    if (danceSection) {
        if (typeof loadDanceEvents === "function") {
            await loadDanceEvents();
        } 
    }

    // Dances function call
    const academicSection = document.querySelector("#acad-details");
    if (academicSection) {
        if (typeof loadAcademicEvents === "function") {
            await loadAcademicEvents();
        } 
    }

    // Esports function call
    const esportsSection = document.querySelector("#esports-details");
    if (esportsSection) {
        if (typeof loadEsportsEvents === "function") {
            await loadEsportsEvents();
        } 
    }

});