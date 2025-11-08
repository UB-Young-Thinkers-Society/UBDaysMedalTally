window.addEventListener('load', function () {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hide');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 600);
    }

    const cards = document.querySelectorAll('.developer-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    cards.forEach(card => observer.observe(card));

    document.querySelectorAll('.tech-card').forEach(card => {
        const btn = card.querySelector('.tech-toggle');
        if (btn) {
            btn.addEventListener('click', function () {
                card.classList.toggle('expanded');
            });
        }
    });
});

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.onclick = function (e) {
        e.preventDefault();
        if (typeof signOut === 'function') {
            signOut();
        }
    };
}