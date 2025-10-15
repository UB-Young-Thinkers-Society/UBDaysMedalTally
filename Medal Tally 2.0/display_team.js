document.addEventListener("DOMContentLoaded", async () => {
    const departmentList = document.querySelector(".department-list");

    const { data, error } = await supabase
        .from("participants")
        .select("acronym, logo");

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
        editBtn.addEventListener("click", () => {
           
        });

        // Delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.classList.add("delete-btn");
        deleteBtn.addEventListener("click", () => {
            
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