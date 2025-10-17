document.addEventListener("DOMContentLoaded", async () => {
    try {
        const { data, error } = await supabase
            .from("academic-events")
            .select("id, name, category, medal_count, status");

        if (error) throw error;

        const academicEvents = data.filter(
            (event) => event.category && event.category.toLowerCase().includes("academics")
        );

        const academicSection = document.getElementById("acad-details");
        const tbody = academicSection.querySelector("tbody");
        tbody.innerHTML = "";

        if (academicEvents.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="5" style="text-align:center;">No athletics events found</td>`;
            tbody.appendChild(tr);
            return;
        }

        //diplay loop
        academicEvents.forEach((event) => {
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
          <button class="delete-btn" data-id="${event.id}">Delete</button>
        </td>
      `;
            tbody.appendChild(tr);
        });
        academicSection.style.display = "block";

    } catch (err) {
        console.error("Error loading athletics events:", err);
    }
});
