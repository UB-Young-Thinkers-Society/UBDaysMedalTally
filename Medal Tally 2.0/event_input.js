document.addEventListener("DOMContentLoaded", async () => {

    const addBtn = document.querySelector(".add_event_btn");
    const eventNameInput = document.querySelector(".event-name");
    const eventCategoryInput = document.querySelector(".event-category");
    const eventMedalInput = document.querySelector(".event-medal");

    if (!addBtn || !eventNameInput || !eventCategoryInput || !eventMedalInput) {
        console.warn("Event input elements not found.");
        return;
    }

    const tableMap = {
        music: "music-events",
        athletics: "athletic-events",
        dances: "dances-events",
        academics: "academic-events",
        esports: "esports-events",
    };

    const eventId = localStorage.getItem("edit_event_id");
    const eventCategory = localStorage.getItem("edit_event_category");

    const isEditing = !!eventId && !!eventCategory;

    if (isEditing) {

        const tableName = tableMap[eventCategory.toLowerCase()];
        if (!tableName) {
            alert("Unknown event category: " + eventCategory);
            return;
        }

        const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .eq("id", eventId)
            .single();

        if (error) {
            console.error("Error loading event data:", error.message);
            alert("Failed to load event data.");
            return;
        }

        eventNameInput.value = data.name || "";
        eventMedalInput.value = data.medal_count ?? "";
        eventCategoryInput.value = data.category || "";
        addBtn.textContent = "Save Changes";
    }

    addBtn.addEventListener("click", async () => {
        const eventName = eventNameInput.value.trim();
        const eventCategory = eventCategoryInput.value.trim().toLowerCase();
        const eventMedalCount = parseInt(eventMedalInput.value);

        if (!eventName || !eventCategory || isNaN(eventMedalCount)) {
            alert("Please fill in all fields correctly.");
            return;
        }

        const tableName = tableMap[eventCategory];
        if (!tableName) {
            alert("Unknown event category: " + eventCategory);
            return;
        }

        let result;
        if (isEditing) {
            result = await supabase
                .from(tableName)
                .update({
                    name: eventName,
                    medal_count: eventMedalCount,
                    category: eventCategory,
                    status: "ongoing",
                })
                .eq("id", eventId);
        } else {
            result = await supabase
                .from(tableName)
                .insert([
                    { name: eventName, medal_count: eventMedalCount, category: eventCategory, status: "ongoing" },
                ]);
        }

        const { error } = result;
        if (error) {
            alert("Error saving event: " + error.message);
        } else {
            alert(isEditing ? "Event updated successfully!" : "Event added successfully!");

            localStorage.removeItem("edit_event_id");
            localStorage.removeItem("edit_event_category");

            window.location.href = "tabulation.html";
        }
    });
});
