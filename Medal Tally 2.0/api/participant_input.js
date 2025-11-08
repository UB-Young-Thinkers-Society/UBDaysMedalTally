let currentEditingId = null; 
const addParticipantBtn = document.querySelector('.add_participant_btn');
const logoInput = document.querySelector('.add-logo');
const nameInput = document.querySelector('.name');
const acronymInput = document.querySelector('.acronym');

addParticipantBtn.addEventListener('click', async () => {
    const file = logoInput.files[0];
    const name = nameInput.value.trim();
    const acronym = acronymInput.value.trim();

    if (!name || !acronym) {
        alert('Please fill in the name and acronym.');
        return;
    }

    let logoUrl = null;

    if (file) {
        const filePath = `${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('logos')
            .upload(filePath, file);

        if (uploadError) {
            alert('Error uploading image: ' + uploadError.message);
            return;
        }

        const { data: publicData } = supabase
            .storage
            .from('logos')
            .getPublicUrl(filePath);

        logoUrl = publicData.publicUrl;
    }

    if (currentEditingId) {
        const updateData = {
            name: name,
            acronym: acronym
        };

        if (logoUrl) updateData.logo = logoUrl;

        const { error: updateError } = await supabase
            .from('participants')
            .update(updateData)
            .eq('id', currentEditingId);

        if (updateError) {
            alert('Error updating participant: ' + updateError.message);
        } else {
            alert('Participant updated successfully!');
            currentEditingId = null; // reset
            nameInput.value = '';
            acronymInput.value = '';
            logoInput.value = '';
            location.reload();
        }

    } else {
        if (!file) {
            alert('Please select a logo when adding a new participant.');
            return;
        }

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
            alert('Error adding participant: ' + error.message);
        } else {
            alert('Participant added successfully!');
            nameInput.value = '';
            acronymInput.value = '';
            logoInput.value = '';
            location.reload();
        }
    }
});
