const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function reload() {
    const { error } = await supabase.rpc('reload_schema_cache');
    if (error) {
        // sometimes there's no reload function, we can do it differently or just let it naturally expire (usually 1 minute or less depending on config).
        console.error(error);
    } else {
        console.log("Schema reloaded");
    }
}
reload();
