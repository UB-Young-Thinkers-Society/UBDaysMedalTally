document.querySelectorAll('.category').forEach(function(catDiv) {
    catDiv.addEventListener('click', function() {
        var arrow = catDiv.querySelector('#arrow');
        const detailsId = catDiv.getAttribute('data-details');
        const detailsDiv = document.getElementById(detailsId);
        if (!detailsDiv) return;
        if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
            detailsDiv.style.display = 'block';
            detailsDiv.style.opacity = 0;
            detailsDiv.style.transition = 'opacity 0.2s';
            setTimeout(function() {
                detailsDiv.style.opacity = 1;
            }, 10);
            arrow.style.transition = 'transform 0.2s';
            arrow.style.transform = 'rotate(180deg)';
        } else {
            detailsDiv.style.opacity = 0;
            detailsDiv.style.transition = 'opacity 0.2s';
            setTimeout(function() {
                detailsDiv.style.display = 'none';
            }, 300);
            arrow.style.transition = 'transform 0.2s';
            arrow.style.transform = 'rotate(0deg)';
        }
    });
});

document.getElementById('logoutBtn').onclick = function(e) {
    e.preventDefault();
    signOut();
};
