const addBtn = document.querySelector('.add_event_btn');
const eventNameInput = document.querySelector('.event-name');
const eventCategoryInput = document.querySelector('.event-category');
const eventMedalInput = document.querySelector('.event-medal');

addBtn.addEventListener('click', async () => {
    const eventName = eventNameInput.value.trim();
    const eventCategory = eventCategoryInput.value.trim();
    const eventMedalCount = parseInt(eventMedalInput.value);

    if (!eventName || !eventCategory || isNaN(eventMedalCount)) {
        alert('Please fill in all fields correctly.');
        return;
    }

    // Map allowed category option values to their corresponding table names
    const tableMap = {
        'music': 'music-events',
        'athletics': 'athletic-events',
        'dances': 'dances-events',
        'academics': 'academic-events',
        'esports': 'esports-events'
    };

    const categoryKey = eventCategory.toLowerCase();
    const tableName = tableMap[categoryKey];

    if (!tableName) {
        alert('Unknown event category: ' + eventCategory);
        return;
    }

    const { data, error } = await supabase
        .from(tableName)
        .insert([
            {
                name: eventName,
                category: eventCategory,
                medal_count: eventMedalCount
            }
        ]);

    if (error) {
        console.error('Error inserting data:', error);
        alert('Error adding event: ' + error.message);
    } else {
        console.log('Inserted:', data);
        alert('Event added successfully!');

        eventNameInput.value = '';
        eventCategoryInput.value = '';
        eventMedalInput.value = '';
    }
});
