document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("delete-btn")) return;

    const eventId = e.target.dataset.id;
    const category = e.target.dataset.category?.toLowerCase();
    if (!eventId || !category) {
        console.error("Missing event ID or category for deletion");
        return;
    }

    const tableMap = {
        music: "music-events",
        athletics: "athletic-events",
        dances: "dances-events",
        academics: "academic-events",
        esports: "esports-events",
    };

    const tableName = tableMap[category];
    if (!tableName) {
        console.error(`No table found for category: ${category}`);
        return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete this ${category} event?`);
    if (!confirmDelete) return;

    try {
        const { error } = await supabase.from(tableName).delete().eq("id", eventId);
        if (error) throw error;
        const row = e.target.closest("tr");
        if (row) row.remove();

        alert(`Event successfully deleted from ${tableName}!`);
    } catch (err) {
        console.error("Error deleting event:", err.message);
        alert("Failed to delete event. Check console for details.");
    }
});
