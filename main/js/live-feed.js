// UBDays 2026 - Live Medal Tally Feed Logic

let rawTeams = [];
let currentLeague = 'seniors'; // 'seniors' (Live Count) or 'juniors' (Juniors League)
let currentSort = {
    key: 'default', // 'default', 'name', 'gold', 'silver', 'bronze', 'total'
    direction: 'desc' // 'desc' (highest to lowest), 'asc' (lowest to highest)
};

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
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
 * Initializes the bottom floating pill tabs (LIVE COUNT vs JUNIORS LEAGUE)
 */
function initTabs() {
    const liveBtn = document.getElementById('tab-live-btn');
    const juniorsBtn = document.getElementById('tab-juniors-btn');

    // Check URL parameters (e.g., from details-category.html or bookmark: ?tab=juniors)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'juniors') {
        currentLeague = 'juniors';
    } else {
        currentLeague = 'seniors';
    }

    updateTabUI();

    if (liveBtn) {
        liveBtn.addEventListener('click', () => {
            if (currentLeague === 'seniors') return;
            currentLeague = 'seniors';
            onLeagueTabChanged();
        });
    }

    if (juniorsBtn) {
        juniorsBtn.addEventListener('click', () => {
            if (currentLeague === 'juniors') return;
            currentLeague = 'juniors';
            onLeagueTabChanged();
        });
    }
}

/**
 * Updates UI buttons, banner title, and URL parameter when tab changes
 */
function onLeagueTabChanged() {
    updateTabUI();
    const newTabParam = currentLeague === 'juniors' ? 'juniors' : 'live';
    const newUrl = `${window.location.pathname}?tab=${newTabParam}`;
    window.history.replaceState(null, '', newUrl);
    fetchAndRenderTally(true);
}

/**
 * Synchronizes pill button active states and header banner title
 */
function updateTabUI() {
    const liveBtn = document.getElementById('tab-live-btn');
    const juniorsBtn = document.getElementById('tab-juniors-btn');
    const bannerTitle = document.getElementById('tally-banner-title');

    if (currentLeague === 'juniors') {
        if (liveBtn) {
            liveBtn.classList.remove('active');
            liveBtn.removeAttribute('aria-current');
        }
        if (juniorsBtn) {
            juniorsBtn.classList.add('active');
            juniorsBtn.setAttribute('aria-current', 'page');
        }
        if (bannerTitle) {
            bannerTitle.textContent = 'JUNIORS LEAGUE MEDAL TALLY';
        }
    } else {
        if (juniorsBtn) {
            juniorsBtn.classList.remove('active');
            juniorsBtn.removeAttribute('aria-current');
        }
        if (liveBtn) {
            liveBtn.classList.add('active');
            liveBtn.setAttribute('aria-current', 'page');
        }
        if (bannerTitle) {
            bannerTitle.textContent = 'OFFICIAL MEDAL TALLY';
        }
    }
}

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
        const emptyMsg = currentLeague === 'juniors' 
            ? 'No teams assigned to Juniors League yet.' 
            : 'No teams or results found.';
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600; color: #64748B;">${emptyMsg}</td></tr>`;
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
 * @param {boolean} showLoading - If true, displays quick loading row (e.g. on manual tab switch)
 */
async function fetchAndRenderTally(showLoading = false) {
    const tbody = document.getElementById('tally-body');
    const scrollY = window.scrollY;
    const activeElement = document.activeElement;

    if (showLoading && tbody) {
        const leagueLabel = currentLeague === 'juniors' ? 'Juniors League' : 'live';
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600; color: #64748B;">Loading ${leagueLabel} medal tally...</td></tr>`;
    }

    try {
        const response = await fetch(`/api/data?type=medalTally&league=${encodeURIComponent(currentLeague)}`);
        if (!response.ok) {
            throw new Error('Failed to load data from the server.');
        }

        const teams = await response.json();
        rawTeams = Array.isArray(teams) ? teams : [];

        updateSortHeaderUI();
        renderTallyRows();
    } catch (error) {
        console.error('Error fetching medal tally:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; font-weight: 600; color: #DC2626;">Error: ${error.message}</td></tr>`;
        }
    } finally {
        if (!showLoading) {
            window.scrollTo(0, scrollY);
        }
        if (activeElement && activeElement.focus) {
            activeElement.focus();
        }
    }
}
// --- HIDE TALLY OVERLAY LOGIC (DB-backed, visible on all screens) ---

async function fetchAndApplyOverlay() {
    const overlay = document.getElementById('hide-tally-overlay');
    const yearEl = document.getElementById('hide-tally-year-display');
    const dateEl = document.getElementById('hide-tally-date-display');
    const locWrap = document.getElementById('hide-tally-location-wrap');
    const locEl = document.getElementById('hide-tally-location-display');
    if (!overlay) return;

    try {
        const res = await fetch('/api/data?type=appSettings');
        if (!res.ok) return;
        const settings = await res.json();

        const isHidden = settings['hide_tally'] === 'true';
        const savedDate = settings['hide_tally_date'] || '';
        const savedLocation = (settings['hide_tally_location'] || '').trim();
        const year = settings['hide_tally_year'] || (savedDate ? new Date(savedDate + 'T00:00:00').getFullYear() : new Date().getFullYear());

        if (isHidden) {
            if (yearEl) yearEl.textContent = year;

            const formattedDate = savedDate ? formatOverlayDate(savedDate) : 'a date to be announced';
            if (dateEl) dateEl.textContent = formattedDate;

            if (locWrap && locEl) {
                if (savedLocation) {
                    locEl.textContent = savedLocation;
                    locWrap.style.display = 'inline';
                } else {
                    locWrap.style.display = 'none';
                }
            }

            overlay.style.display = 'flex';
            overlay.setAttribute('aria-hidden', 'false');
        } else {
            overlay.style.display = 'none';
            overlay.setAttribute('aria-hidden', 'true');
        }
    } catch (err) {
        console.warn('Could not fetch overlay state:', err);
    }
}

function formatOverlayDate(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAndApplyOverlay();
    // Re-check overlay state every 30 seconds (same cadence as the live feed refresh)
    setInterval(fetchAndApplyOverlay, 30000);
});