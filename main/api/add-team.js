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

    try {
        // 1. Parse the multipart form data using formidable
        const form = new Formidable({}); // <-- ADD 'new' HERE
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

        res.status(200).json({ success: true, data: insertData[0] });

    } catch (error) {
        console.error('Error in /api/add-team:', error);
        res.status(500).json({ error: error.message });
    }
};