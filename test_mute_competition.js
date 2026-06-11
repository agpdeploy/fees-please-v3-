const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const clubId = '608a88c8-8e7f-484f-9553-409b7d4fe0a6';
  const newSettings = {
    playhq_org_id: '462e4428',
    playhq_tenant: 'cricket-australia',
    ignored_playhq_competition_ids: ['83125a25'],
    notified_playhq_season_ids: []
  };

  const { data, error } = await supabase
    .from('clubs')
    .update({ settings: newSettings })
    .eq('id', clubId)
    .select();

  if (error) {
    console.error('Update failed:', error);
  } else {
    console.log('Successfully muted competition.');
  }
}
run();
