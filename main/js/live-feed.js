// UBDays 2026 - Live Medal Tally Feed Logic

let rawTeams = [];
let currentSort = {
    key: 'default', // 'default', 'name', 'gold', 'silver', 'bronze', 'total'
    direction: 'desc' // 'desc' (highest to lowest), 'asc' (lowest to highest)
};

document.addEventListener('DOMContentLoaded', () => {
    setupSortListeners();
    fetchAndRenderTally();
    updateTimestamp();

    // Auto-refresh data and timestamp every 60 seconds
    setInterval(() => {
        fetchAndRenderTally();
        updateTimestamp();
    }, 60000);
});

/**
 * Updates the timestamp with the format: "as of [Month Day, Year] | [Time AM/PM]"
 */
function updateTimestamp() {
    const subtitle = document.getElementById('last-updated');
    if (!subtitle) return;

    const now = new Date();
    const datePart = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const timePart = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    });

    subtitle.textContent = `as of ${datePart} | ${timePart}`;
}

/**
 * Sets up click event listeners on table column headers for sorting with chevrons
 */
function setupSortListeners() {
    const headers = document.querySelectorAll('.tally-table th.sortable');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sortKey;
            if (!key) return;

            if (currentSort.key === key) {
                // If clicking current column: toggle desc -> asc -> default
                if (currentSort.direction === 'desc') {
                    currentSort.direction = 'asc';
                } else {
                    currentSort.key = 'default';
                    currentSort.direction = 'desc';
                }
            } else {
                currentSort.key = key;
                // Default order: alphabetical 'asc' for department name, highest-to-lowest 'desc' for medals
                currentSort.direction = (key === 'name') ? 'asc' : 'desc';
            }

            updateSortHeaderUI();
            renderTallyRows();
        });
    });
}

/**
 * Updates the visual chevron indicators on the sortable table headers
 */
function updateSortHeaderUI() {
    const headers = document.querySelectorAll('.tally-table th.sortable');
    headers.forEach(th => {
        const key = th.dataset.sortKey;
        th.classList.remove('sort-active-desc', 'sort-active-asc');
        th.setAttribute('aria-sort', 'none');

        if (currentSort.key === key) {
            if (currentSort.direction === 'desc') {
                th.classList.add('sort-active-desc');
                th.setAttribute('aria-sort', 'descending');
            } else {
                th.classList.add('sort-active-asc');
                th.setAttribute('aria-sort', 'ascending');
            }
        }
    });
}

/**
 * Returns a sorted copy of the teams array according to currentSort
 */
function getSortedTeams(teams, sortKey, sortDir) {
    const list = [...teams];

    if (sortKey === 'default') {
        // Olympic Ranking standard: Gold desc -> Silver desc -> Bronze desc -> Total desc -> Name asc
        return list.sort((a, b) => {
            if (b.gold !== a.gold) return b.gold - a.gold;
            if (b.silver !== a.silver) return b.silver - a.silver;
            if (b.bronze !== a.bronze) return b.bronze - a.bronze;
            if (b.total !== a.total) return b.total - a.total;
            return a.name.localeCompare(b.name);
        });
    }

    const factor = (sortDir === 'asc') ? 1 : -1;

    return list.sort((a, b) => {
        if (sortKey === 'name') {
            return factor * a.name.localeCompare(b.name);
        }

        const valA = Number(a[sortKey]) || 0;
        const valB = Number(b[sortKey]) || 0;

        if (valA !== valB) {
            return factor * (valA - valB);
        }

        // Tie-breakers when selected medal counts are equal
        if (sortKey !== 'gold' && b.gold !== a.gold) return b.gold - a.gold;
        if (sortKey !== 'silver' && b.silver !== a.silver) return b.silver - a.silver;
        if (sortKey !== 'bronze' && b.bronze !== a.bronze) return b.bronze - a.bronze;
        return a.name.localeCompare(b.name);
    });
}

/**
 * Renders the sorted rows in the table body
 */
function renderTallyRows() {
    const tbody = document.getElementById('tally-body');
    if (!tbody) return;

    if (!rawTeams || rawTeams.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600;">No teams or results found.</td></tr>`;
        return;
    }

    const sortedTeams = getSortedTeams(rawTeams, currentSort.key, currentSort.direction);

    tbody.innerHTML = '';
    sortedTeams.forEach(team => {
        const tr = document.createElement('tr');
        const logo = team.logo_url || 'img/Login-Logo.png';

        tr.innerHTML = `
            <td class="col-dept">
                <img src="${logo}" class="dept-logo" alt="${team.acronym || ''} Logo" onerror="this.src='img/Login-Logo.png';">
                <span class="dept-name full-name">${team.name}</span>
                <span class="dept-name acronym">${team.acronym}</span>
            </td>
            <td class="gold"><span class="medal-count">${team.gold}</span></td>
            <td class="silver"><span class="medal-count">${team.silver}</span></td>
            <td class="bronze"><span class="medal-count">${team.bronze}</span></td>
            <td class="total">${team.total}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Fetches the medal tally from the API and renders the table without resetting sort
 */
async function fetchAndRenderTally() {
    const tbody = document.getElementById('tally-body');
    const scrollY = window.scrollY;
    const activeElement = document.activeElement;

    try {
        const response = await fetch('/api/data?type=medalTally');
        if (!response.ok) {
            throw new Error('Failed to load data from the server.');
        }

        const teams = await response.json();
        rawTeams = Array.isArray(teams) ? teams : [];

        updateSortHeaderUI();
        renderTallyRows();
    } catch (error) {
        console.error('Error fetching medal tally:', error);
        if (tbody && rawTeams.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600; color: #DC2626;">Error: ${error.message}</td></tr>`;
        }
    } finally {
        window.scrollTo(0, scrollY);
        if (activeElement && activeElement.focus) {
            activeElement.focus();
        }
    }
}