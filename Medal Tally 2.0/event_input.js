document.addEventListener("DOMContentLoaded", () => {

    // More robust page detection: check for a known DOM node instead of a fragile pathname check
    const isTabulationPage = window.location.pathname.toLowerCase().includes("tabulation.html")
        || window.location.pathname.toLowerCase().includes("/tabulation")
        || document.querySelector(".categories") !== null;

    if (isTabulationPage) {

        // Attach delegated click handler immediately (works when script is included at end of <body>)
        document.body.addEventListener("click", async (e) => {
            const btn = e.target.closest && e.target.closest(".edit-btn");
            if (!btn) return;

            const id = btn.dataset.id;
            const category = (btn.dataset.category || "").toLowerCase();

            const tableMap = {
                'music': 'music-events',
                'athletics': 'athletic-events',
                'dances': 'dances-events',
                'academics': 'academic-events',
                'esports': 'esports-events'
            };
            const tableName = tableMap[category];

            if (!tableName) {
                alert("Unknown event category");
                return;
            }

            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select("*")
                    .eq("id", id)
                    .single();

                if (error) {
                    alert("Error loading event: " + error.message);
                    return;
                }

                localStorage.setItem("edit_event_id", id);
                localStorage.setItem("edit_event_category", category);
                localStorage.setItem("edit_event_name", data.name);
                localStorage.setItem("edit_event_medal", data.medal_count);

                setTimeout(() => {
                    window.location.href = "config.html";
                }, 300);
            } catch (err) {
                console.error(err);
                alert("Unexpected error loading event.");
            }
        });
    }

    // Initialize add/edit form if present
    const addBtn = document.querySelector(".add_event_btn");
    const eventNameInput = document.querySelector(".event-name");
    const eventCategoryInput = document.querySelector(".event-category");
    const eventMedalInput = document.querySelector(".event-medal");

    if (addBtn) {
        const tableMap = {
            'music': 'music-events',
            'athletics': 'athletic-events',
            'dances': 'dances-events',
            'academics': 'academic-events',
            'esports': 'esports-events'
        };

        const eventId = localStorage.getItem("edit_event_id");
        const isEditing = !!eventId;

        if (isEditing) {
            if (eventNameInput) eventNameInput.value = localStorage.getItem("edit_event_name") || "";
            if (eventMedalInput) eventMedalInput.value = localStorage.getItem("edit_event_medal") || "";
            if (eventCategoryInput) eventCategoryInput.value = localStorage.getItem("edit_event_category") || "";
            addBtn.textContent = "Save Changes";
        }

        addBtn.addEventListener("click", async () => {
            const eventName = (eventNameInput?.value || "").trim();
            const eventCategory = (eventCategoryInput?.value || "").trim().toLowerCase();
            const eventMedalCount = parseInt(eventMedalInput?.value, 10);

            if (!eventName || !eventCategory || isNaN(eventMedalCount)) {
                alert("Please fill in all fields correctly.");
                return;
            }

            const tableName = tableMap[eventCategory];
            if (!tableName) {
                alert("Unknown event category: " + eventCategory);
                return;
            }

            try {
                let result;
                if (isEditing) {
                    result = await supabase
                        .from(tableName)
                        .update({
                            name: eventName,
                            medal_count: eventMedalCount,
                            category: eventCategory
                        })
                        .eq("id", eventId);
                } else {
                    result = await supabase
                        .from(tableName)
                        .insert([
                            { name: eventName, medal_count: eventMedalCount, category: eventCategory }
                        ]);
                }

                const { error } = result;
                if (error) {
                    alert("Error saving event: " + error.message);
                } else {
                    alert(isEditing ? "Event updated successfully!" : "Event added successfully!");
                    localStorage.removeItem("edit_event_id");
                    localStorage.removeItem("edit_event_category");
                    localStorage.removeItem("edit_event_name");
                    localStorage.removeItem("edit_event_medal");
                    window.location.href = "tabulation.html";
                }
            } catch (err) {
                console.error(err);
                alert("Unexpected error saving event.");
            }
        });
    }
});
