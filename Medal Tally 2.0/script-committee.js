document.getElementById('logout-btn').onclick = function(e) {
    e.preventDefault();
    window.location.href = 'index.html';
};

const rankingList = document.getElementById('rankingList');

new Sortable(rankingList, {
    animation: 150,
    handle: '.tab-input, .tab-num',
    ghostClass: 'sortable-ghost',
    onEnd: () => {
        const rows = rankingList.querySelectorAll('.tab-row');
        rows.forEach((row, index) => {
            const numElement = row.querySelector('.tab-num');
            if (numElement) {
                numElement.textContent = index + 1;
            }
        });
    }
});