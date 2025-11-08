document.addEventListener("DOMContentLoaded", async () => {
    const categoryMap = {
        "esports-details": "esports-events",
        "music-details": "music-events",
        "dances-details": "dances-events",
        "acad-details": "academic-events",
        "athletics-details": "athletic-events",
    };

    for (const [detailsKey, tableName] of Object.entries(categoryMap)) {
        const categoryDiv = document.querySelector(`[data-details="${detailsKey}"]`);
        if (!categoryDiv) continue;

        const statusDiv = categoryDiv.querySelector(".cat-status");
        if (!statusDiv) continue;

        const { data, error } = await supabase.from(tableName).select("status");

        if (error) {
            console.error(`Error fetching from ${tableName}:`, error.message);
            statusDiv.textContent = "Error loading status";
            continue;
        }

        let ongoingCount = 0;
        let submittedCount = 0;
        let publishedCount = 0;

        data.forEach((row) => {
            const status = row.status?.toLowerCase();
            if (status === "ongoing") ongoingCount++;
            else if (status === "submitted") submittedCount++;
            else if (status === "published") publishedCount++;
        });

        statusDiv.innerHTML = `
      ${ongoingCount} Ongoing &nbsp;|&nbsp;
      ${submittedCount} Submitted &nbsp;|&nbsp;
      ${publishedCount} Published
    `;
    }
});
