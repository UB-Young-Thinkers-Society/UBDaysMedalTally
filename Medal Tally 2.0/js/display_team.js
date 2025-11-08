document.addEventListener("DOMContentLoaded", async () => {
    const departmentList = document.querySelector(".department-list");

    const { data, error } = await supabase
        .from("participants")
        .select("id, name, acronym, logo");

    if (error) {
        console.error("Error fetching teams:", error);
        departmentList.innerHTML = "<p>Failed to load teams.</p>";
        return;
    }

    if (!data || data.length === 0) {
        departmentList.innerHTML = "<p>No teams found.</p>";
        return;
    }

    departmentList.innerHTML = "";



    //wala na ko kasabot ari na part.
    //ang nahitabo is mag create siya kaugalingon div ug span na naay kaugalingon css????

    data.forEach(team => {
        const departmentDiv = document.createElement("div");
        departmentDiv.classList.add("department");

        // Logo
        const logoDiv = document.createElement("div");
        logoDiv.classList.add("dept-logo-placeholder");

        if (team.logo) {
            const img = document.createElement("img");
            img.src = team.logo;
            img.alt = `${team.acronym} Logo`;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            logoDiv.appendChild(img);
        }

        const nameSpan = document.createElement("span");
        nameSpan.classList.add("dept-name");
        nameSpan.textContent = team.acronym;

            // Edit button
            const editBtn = document.createElement("button");
            editBtn.textContent = "Edit";
            editBtn.classList.add("edit-btn");
            editBtn.addEventListener("click", async () => {
                currentEditingId = team.id;
                document.querySelector(".name").value = team.name;
                document.querySelector(".acronym").value = team.acronym;

                const logoPreview = document.querySelector(".logo-preview");
                if (logoPreview && team.logo) {
                    logoPreview.src = team.logo;
                }

                const addBtn = document.querySelector(".add_participant_btn");
                addBtn.textContent = "Save Changes";
            });

            // Delete button
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.classList.add("delete-btn");
            deleteBtn.addEventListener("click", async () => { 
                const confirmDelete = confirm(`Delete team "${team.acronym}"?`);
                if (!confirmDelete) return;

                const { error } = await supabase
                    .from("participants")
                    .delete()
                    .eq("acronym", team.acronym);

                if (error) {
                    alert("Failed to delete team. Check console for details.");
                } else {
                    departmentDiv.remove();
                    alert(`"${team.acronym}" has been deleted.`);
                }
            });

        // Append logo, name, and buttons to department div
        departmentDiv.appendChild(logoDiv);
        departmentDiv.appendChild(nameSpan);
        departmentDiv.appendChild(editBtn);
        departmentDiv.appendChild(deleteBtn);

        // Append department div to the list
        departmentList.appendChild(departmentDiv);
    });
});
