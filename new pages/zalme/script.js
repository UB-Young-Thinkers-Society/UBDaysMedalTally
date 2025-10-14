// Add functionality to buttons
document.getElementById('confirmButton').addEventListener('click', function() {
    // Show confirmation modal
    document.getElementById('confirmationModal').style.display = 'flex';
});

document.querySelector('.cancel-btn').addEventListener('click', function() {
    if(confirm('Are you sure you want to cancel your registration? This action cannot be undone.')) {
        // In a real application, you would redirect or reset the form here
        alert('Registration cancelled.');
        
        // Redirect to events page (in a real application)
        // window.location.href = 'events.html';
    }
});

// Modal functionality
document.getElementById('modalOkButton').addEventListener('click', function() {
    document.getElementById('confirmationModal').style.display = 'none';
    // In a real application, you might redirect to a dashboard or home page
    // window.location.href = 'dashboard.html';
});

document.getElementById('modalPrintButton').addEventListener('click', function() {
    window.print();
});

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
    const modal = document.getElementById('confirmationModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});