document.addEventListener("DOMContentLoaded", async () => {
    try {
        const { data, error } = await supabase
            .from("music-events")
            .select("id, name, category, medal_count, status");

        if (error) throw error;

        const musicEvents = data.filter(
            (event) => event.category && event.category.toLowerCase().includes("music")
        );

        const musicSection = document.getElementById("music-details");
        const tbody = musicSection.querySelector("tbody");
        tbody.innerHTML = "";

        if (musicEvents.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="5" style="text-align:center;">No music events found</td>`;
            tbody.appendChild(tr);
            return;
        }

        //diplay loop
        musicEvents.forEach((event) => {
            const eventName = event.name || "Unnamed Event";
            const medalCount = event.medal_count ?? "0";
            const statusText = event.status || "N/A";
            const statusClass = event.status ? event.status.toLowerCase() : "none";

            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${eventName}</td>
        <td>${medalCount}</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td>
          <button class="filter review">For Review</button>
          <button class="filter approved">Approved</button>
          <button class="filter published">Published</button>
          <button class="filter locked">Locked</button>
        </td>
        <td>
          <button class="edit-btn" data-id="${event.id}">Edit</button>
          <button class="delete-btn" data-id="${event.id}" data-category="${event.category}">Delete</button>
        </td>
      `;
            tbody.appendChild(tr);
            const deleteBtn = tr.querySelector(".delete-btn");
            deleteBtn.addEventListener("click", () => {
                deleteEvent(event.id, event.name);
            });
        });
        musicSection.style.display = "block";

    } catch (err) {
        console.error("Error loading music events:", err);
    }
});
