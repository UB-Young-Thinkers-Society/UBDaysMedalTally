// // This is a secure serverless function (Node.js)
// import { supabase } from './db_connection.js';
// import { Formidable } from 'formidable';
// import fs from 'fs';

// // Vercel disables the body parser for us if we export this config
// export const config = {
//     api: {
//         bodyParser: false,
//     },
// };

// export default async (req, res) => {
//     if (req.method !== 'POST') {
//         return res.status(405).json({ error: 'Method Not Allowed' });
//     }

//     try {
//         // 1. Parse the multipart form data using formidable
//         const form = new Formidable({}); // <-- ADD 'new' HERE
//         const [fields, files] = await form.parse(req);

//         // Extract text fields
//         const name = fields.name?.[0];
//         const acronym = fields.acronym?.[0];
        
//         // Extract file
//         const logoFile = files.logoFile?.[0];

//         if (!name || !acronym || !logoFile) {
//             return res.status(400).json({ error: 'Missing required fields.' });
//         }

//         // 2. Read the file from its temporary path
//         const fileContent = fs.readFileSync(logoFile.filepath);

//         // 3. Upload the logo file to Supabase Storage
//         const fileName = `${Date.now()}_${logoFile.originalFilename}`;
//         const { data: uploadData, error: uploadError } = await supabase.storage
//             .from('logos') // Make sure this bucket exists
//             .upload(fileName, fileContent, {
//                 contentType: logoFile.mimetype,
//                 upsert: false,
//             });

//         if (uploadError) throw uploadError;

//         // 4. Get the public URL of the uploaded file
//         const { data: publicData } = supabase.storage
//             .from('logos')
//             .getPublicUrl(fileName);

//         const logoUrl = publicData.publicUrl;

//         // 5. Insert into the NEW 'teams' table
//         const { data: insertData, error: insertError } = await supabase
//             .from('teams')
//             .insert([
//                 {
//                     name: name,
//                     acronym: acronym,
//                     logo_url: logoUrl 
//                 }
//             ])
//             .select();

//         if (insertError) throw insertError;

//         res.status(200).json({ success: true, data: insertData[0] });

//     } catch (error) {
//         console.error('Error in /api/add-team:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// This is a secure serverless function (Node.js)
import { supabase } from './db_connection.js';
import { Formidable } from 'formidable';
import fs from 'fs';

// Vercel disables the body parser for us if we export this config
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let user; // Define user here for logging

    try {
        // --- ADDED: AUTHENTICATION ---
        // We must get the user *before* parsing the form
        // The client-side fetch MUST send the 'Authorization' header.
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization header missing.' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authUser) {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        user = authUser; // Assign to outer scope
        // --- END: AUTHENTICATION ---


        // 1. Parse the multipart form data using formidable
        const form = new Formidable({});
        const [fields, files] = await form.parse(req);

        // Extract text fields
        const name = fields.name?.[0];
        const acronym = fields.acronym?.[0];
        
        // Extract file
        const logoFile = files.logoFile?.[0];

        if (!name || !acronym || !logoFile) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        // 2. Read the file from its temporary path
        const fileContent = fs.readFileSync(logoFile.filepath);

        // 3. Upload the logo file to Supabase Storage
        const fileName = `${Date.now()}_${logoFile.originalFilename}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('logos') // Make sure this bucket exists
            .upload(fileName, fileContent, {
                contentType: logoFile.mimetype,
                upsert: false,
            });

        if (uploadError) throw uploadError;

        // 4. Get the public URL of the uploaded file
        const { data: publicData } = supabase.storage
            .from('logos')
            .getPublicUrl(fileName);

        const logoUrl = publicData.publicUrl;

        // 5. Insert into the NEW 'teams' table
        const { data: insertData, error: insertError } = await supabase
            .from('teams')
            .insert([
                {
                    name: name,
                    acronym: acronym,
                    logo_url: logoUrl 
                }
            ])
            .select();

        if (insertError) throw insertError;

        // --- UPDATED: LOG THIS ACTION ---
        try {
            await supabase.from('audit_log').insert({
                user_id: user.id, // <-- CHANGED
                actions: 'addTeam',
                details: `Added new team: ${name} (${acronym})`
            });
        } catch (logError) {
            console.error('Failed to write to audit log:', logError);
        }
        // --- END: LOG ---

        res.status(200).json({ success: true, data: insertData[0] });

    } catch (error) {
        console.error('Error in /api/add-team:', error);
        
        // --- UPDATED: LOG ERROR ---
        if (user) {
            try {
                await supabase.from('audit_log').insert({
                    user_id: user.id, // <-- CHANGED
                    actions: 'error',
                    details: `Failed action "addTeam": ${error.message}`
                });
            } catch (logError) {
                console.error('Failed to write error to audit log:', logError);
            }
        }
        // --- END: LOG ERROR ---
        
        res.status(500).json({ error: error.message });
    }
};