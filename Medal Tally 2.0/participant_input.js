const addParticipantBtn = document.querySelector('.add_participant_btn');
const logoInput = document.querySelector('.add-logo');
const nameInput = document.querySelector('.name');
const acronymInput = document.querySelector('.acronym');

addParticipantBtn.addEventListener('click', async () => {
    const file = logoInput.files[0];
    const name = nameInput.value.trim();
    const acronym = acronymInput.value.trim();

    if (!file || !name || !acronym) {
        alert('Please fill in all fields and select an image.');
        return;
    }

    const filePath = `${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

    if (uploadError) {
        console.error('Upload failed:', uploadError);
        alert('Error uploading image: ' + uploadError.message);
        return;
    }

    const { data: publicData } = supabase
        .storage
        .from('logos')
        .getPublicUrl(filePath);

    const logoUrl = publicData.publicUrl;

    const { data, error } = await supabase
        .from('participants')
        .insert([
            {
                name: name,
                acronym: acronym,
                logo: logoUrl 
            }
        ]);

    if (error) {
        console.error('Database insert failed:', error);
        alert('Error adding participant: ' + error.message);
    } else {
        alert('Participant added successfully!');
        nameInput.value = '';
        acronymInput.value = '';
        logoInput.value = '';
    }
});