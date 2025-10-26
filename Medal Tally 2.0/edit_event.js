document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", async (e) => {
        if (e.target.classList.contains("edit-btn")) {
            const eventId = e.target.dataset.id;
            const eventCategory = e.target.dataset.category;

            localStorage.setItem("edit_event_id", eventId);
            localStorage.setItem("edit_event_category", eventCategory);

            window.location.href = "config.html";
        }
    });
});
