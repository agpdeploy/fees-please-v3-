import re

with open("components/Setup.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. State changes
state_re = r'const \[sponsor1Logo, setSponsor1Logo\] = useState\(""\);\s*const \[sponsor1Url, setSponsor1Url\] = useState\(""\);\s*const \[sponsor1Name, setSponsor1Name\] = useState\(""\);\s*const \[sponsor2Logo, setSponsor2Logo\] = useState\(""\);\s*const \[sponsor2Url, setSponsor2Url\] = useState\(""\);\s*const \[sponsor2Name, setSponsor2Name\] = useState\(""\);\s*const \[sponsor3Logo, setSponsor3Logo\] = useState\(""\);\s*const \[sponsor3Url, setSponsor3Url\] = useState\(""\);\s*const \[sponsor3Name, setSponsor3Name\] = useState\(""\);\s*const \[sponsor4Logo, setSponsor4Logo\] = useState\(""\);\s*const \[sponsor4Url, setSponsor4Url\] = useState\(""\);\s*const \[sponsor4Name, setSponsor4Name\] = useState\(""\);\s*const \[sponsorStats, setSponsorStats\] = useState<{.*}>\(\{ impressions: 0, clicks: 0, ctr: 0 \}\);'
state_replacement = '''const [sponsors, setSponsors] = useState<any[]>([]);
  const [sponsorStats, setSponsorStats] = useState<{ impressions: number, clicks: number, ctr: number, details?: Record<string, { imp: number, clk: number, name: string }> }>({ impressions: 0, clicks: 0, ctr: 0 });'''

content = re.sub(state_re, state_replacement, content)

# 2. handleImageUpload changes
upload_re = r"if \(type === 'sponsor1'\) setSponsor1Logo\(data\.publicUrl\);\s*if \(type === 'sponsor2'\) setSponsor2Logo\(data\.publicUrl\);\s*if \(type === 'sponsor3'\) setSponsor3Logo\(data\.publicUrl\);\s*if \(type === 'sponsor4'\) setSponsor4Logo\(data\.publicUrl\);"
upload_replacement = '''if (type.startsWith('sponsor-')) {
          const sId = type.replace('sponsor-', '');
          setSponsors(prev => prev.map(s => s.id === sId ? { ...s, logo_url: data.publicUrl } : s));
        }'''
content = re.sub(upload_re, upload_replacement, content)

content = content.replace("type: 'logo' | 'sponsor1' | 'sponsor2' | 'sponsor3' | 'sponsor4'", "type: string")

# 3. loadClubData Sponsor Fetch changes
load_sponsor_re = r'const \{ data: sponsorData \} = await supabase\.from\("public_team_profiles"\)\.select\("\*"\)\.eq\("team_id", teamData\[0\]\.id\)\.single\(\);\s*if \(sponsorData\) \{\s*setSponsor1Logo\(sponsorData\.sponsor_1_logo \|\| ""\);\s*setSponsor1Url\(sponsorData\.sponsor_1_url \|\| ""\);\s*setSponsor1Name\(sponsorData\.sponsor_1_name \|\| ""\);\s*setSponsor2Logo\(sponsorData\.sponsor_2_logo \|\| ""\);\s*setSponsor2Url\(sponsorData\.sponsor_2_url \|\| ""\);\s*setSponsor2Name\(sponsorData\.sponsor_2_name \|\| ""\);\s*setSponsor3Logo\(sponsorData\.sponsor_3_logo \|\| ""\);\s*setSponsor3Url\(sponsorData\.sponsor_3_url \|\| ""\);\s*setSponsor3Name\(sponsorData\.sponsor_3_name \|\| ""\);\s*setSponsor4Logo\(sponsorData\.sponsor_4_logo \|\| ""\);\s*setSponsor4Url\(sponsorData\.sponsor_4_url \|\| ""\);\s*setSponsor4Name\(sponsorData\.sponsor_4_name \|\| ""\);\s*\}'
load_sponsor_replacement = '''const { data: sponsorData } = await supabase.from("team_sponsors").select("*").in("team_id", teamData.map(t => t.id)).eq('is_active', true);
         if (sponsorData) {
            // Deduplicate across teams if needed, or just take teamData[0]
            const primaryTeamSponsors = sponsorData.filter((s: any) => s.team_id === teamData[0].id);
            setSponsors(primaryTeamSponsors);
         }'''
content = re.sub(load_sponsor_re, load_sponsor_replacement, content)

# 4. Sponsor Analytics
analytics_re = r'let details: Record<number, \{ imp: number, clk: number \}> = \{ 1: \{imp:0, clk:0\}, 2: \{imp:0, clk:0\}, 3: \{imp:0, clk:0\}, 4: \{imp:0, clk:0\} \};\s*if \(sponsorAnalytics\) \{\s*sponsorAnalytics\.forEach\(\(s: any\) => \{\s*if \(s\.event_type === \'impression\'\) \{\s*imp\+\+;\s*if \(s\.sponsor_index\) details\[s\.sponsor_index\]\.imp\+\+;\s*\}\s*if \(s\.event_type === \'click\'\) \{\s*clk\+\+;\s*if \(s\.sponsor_index\) details\[s\.sponsor_index\]\.clk\+\+;\s*\}\s*\}\);\s*\}'
analytics_replacement = '''let details: Record<string, { imp: number, clk: number }> = {};
    if (sponsorAnalytics) {
      sponsorAnalytics.forEach((s: any) => {
        // use sponsor_id if available, fallback to sponsor_index for legacy
        const sKey = s.sponsor_id || s.sponsor_index?.toString();
        if (!sKey) return;
        if (!details[sKey]) details[sKey] = { imp: 0, clk: 0 };
        
        if (s.event_type === 'impression') {
          imp++;
          details[sKey].imp++;
        }
        if (s.event_type === 'click') {
          clk++;
          details[sKey].clk++;
        }
      });
    }'''
content = content.replace('''const { data: sponsorAnalytics, error: sponsorError } = await supabase.from("sponsor_analytics").select("event_type, sponsor_index").in("team_id", teamIds);''', '''const { data: sponsorAnalytics, error: sponsorError } = await supabase.from("sponsor_analytics").select("event_type, sponsor_index, sponsor_id").in("team_id", teamIds);''')
content = re.sub(analytics_re, analytics_replacement, content)

# 5. UI Render inside Sponsors Tab
ui_re = r'\{\[\s*\{\s*name: sponsor1Name \|\| \'Sponsor 1\', stat: sponsorStats\.details\[1\]\s*\},\s*\{\s*name: sponsor2Name \|\| \'Sponsor 2\', stat: sponsorStats\.details\[2\]\s*\},\s*\{\s*name: sponsor3Name \|\| \'Sponsor 3\', stat: sponsorStats\.details\[3\]\s*\},\s*\{\s*name: sponsor4Name \|\| \'Sponsor 4\', stat: sponsorStats\.details\[4\]\s*\}\s*\].map\(\(s, i\) => \(s\.stat\.imp > 0 \|\| s\.stat\.clk > 0\) \? \('
ui_replacement = '''{sponsors.map((s: any, i: number) => {
                          const stat = sponsorStats.details?.[s.id] || { imp: 0, clk: 0 };
                          return (stat.imp > 0 || stat.clk > 0) ? ('''
content = re.sub(ui_re, ui_replacement, content)

# 6. UI Render of Sponsor list block
list_re = r'\[\s*\{ id: \'sponsor1\', num: 1, logo: sponsor1Logo, url: sponsor1Url, name: sponsor1Name, setUrl: setSponsor1Url, setName: setSponsor1Name, clear: \(\) => \{setSponsor1Logo\(""\); setSponsor1Url\(""\); setSponsor1Name\(""\)\} \},\s*\{ id: \'sponsor2\', num: 2, logo: sponsor2Logo, url: sponsor2Url, name: sponsor2Name, setUrl: setSponsor2Url, setName: setSponsor2Name, clear: \(\) => \{setSponsor2Logo\(""\); setSponsor2Url\(""\); setSponsor2Name\(""\)\} \},\s*\{ id: \'sponsor3\', num: 3, logo: sponsor3Logo, url: sponsor3Url, name: sponsor3Name, setUrl: setSponsor3Url, setName: setSponsor3Name, clear: \(\) => \{setSponsor3Logo\(""\); setSponsor3Url\(""\); setSponsor3Name\(""\)\} \},\s*\{ id: \'sponsor4\', num: 4, logo: sponsor4Logo, url: sponsor4Url, name: sponsor4Name, setUrl: setSponsor4Url, setName: setSponsor4Name, clear: \(\) => \{setSponsor4Logo\(""\); setSponsor4Url\(""\); setSponsor4Name\(""\)\} \}\s*\]\.map\(\(s\) => \(\s*<div key=\{s\.id\}'
list_replacement = '''sponsors.map((s, index) => (
                         <div key={s.id}'''
content = re.sub(list_re, list_replacement, content)

# Replace s.logo with s.logo_url
content = content.replace("s.logo ? 'Change Logo'", "s.logo_url ? 'Change Logo'")
content = content.replace("s.logo ? <img src={s.logo}", "s.logo_url ? <img src={s.logo_url}")
content = content.replace('Upload Sponsor ${s.num}', 'Upload Sponsor')
content = content.replace('placeholder={`Sponsor ${s.num} Name (e.g. Nike)`} value={s.name} onChange={(e) => s.setName(e.target.value)}', 'placeholder={`Sponsor Name (e.g. Nike)`} value={s.name} onChange={(e) => setSponsors(prev => prev.map(p => p.id === s.id ? { ...p, name: e.target.value } : p))}')
content = content.replace('value={s.url} onChange={(e) => s.setUrl(e.target.value)}', 'value={s.url} onChange={(e) => setSponsors(prev => prev.map(p => p.id === s.id ? { ...p, url: e.target.value } : p))}')
content = content.replace('handleImageUpload(e, s.id as any)', 'handleImageUpload(e, `sponsor-${s.id}` as any)')

# For the clear button it looks like:
# <button onClick={s.clear}
content = content.replace('onClick={s.clear}', 'onClick={() => setSponsors(prev => prev.map(p => p.id === s.id ? { ...p, logo_url: "", url: "", name: "", is_active: false } : p))}')


# 7. Add Sponsor Button
add_btn = '''
                     {sponsors.filter(s => s.is_active).length < 4 && (
                       <button onClick={() => setSponsors(prev => [...prev, { id: `new-${Date.now()}`, logo_url: "", url: "", name: "", team_id: teams[0]?.id, is_active: true }])} className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-zinc-700/50 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                         + Add Sponsor
                       </button>
                     )}
'''
# We want to place the button after the closing </div> of the sponsors map.
# In Setup.tsx, the map looks like:
#                       </div>
#                    </div>
#                  ))
#                )}
content = content.replace('))}\n                </div>', '))}\n' + add_btn + '                </div>')


# 8. saveConfig changes
save_config_re = r'const \{ error: sponsorError \} = await supabase\.from\("public_team_profiles"\)\.upsert\(\{\s*team_id: teamId,\s*club_id: clubId,\s*sponsor_1_logo: sponsor1Logo, sponsor_1_url: sponsor1Url, sponsor_1_name: sponsor1Name,\s*sponsor_2_logo: sponsor2Logo, sponsor_2_url: sponsor2Url, sponsor_2_name: sponsor2Name,\s*sponsor_3_logo: sponsor3Logo, sponsor_3_url: sponsor3Url, sponsor_3_name: sponsor3Name,\s*sponsor_4_logo: sponsor4Logo, sponsor_4_url: sponsor4Url, sponsor_4_name: sponsor4Name\s*\}, \{ onConflict: "team_id" \}\);'
save_config_replacement = '''
      // Save sponsors
      for (const s of sponsors) {
        if (s.id.startsWith('new-')) {
          if (s.logo_url || s.url || s.name) {
            await supabase.from("team_sponsors").insert({
              team_id: s.team_id,
              logo_url: s.logo_url,
              url: s.url,
              name: s.name,
              is_active: s.is_active
            });
          }
        } else {
          await supabase.from("team_sponsors").update({
            logo_url: s.logo_url,
            url: s.url,
            name: s.name,
            is_active: s.is_active
          }).eq('id', s.id);
        }
      }
      
      const { error: sponsorError } = await supabase.from("public_team_profiles").upsert({
         team_id: teamId,
         club_id: clubId
      }, { onConflict: "team_id" });
'''
content = re.sub(save_config_re, save_config_replacement, content)

# 9. saveConfig validation
content = content.replace('''
        if (hasFeature(clubRecord, 'SPONSORS')) {
          teamUpdates.push(
            supabase.from("public_team_profiles").update({
              sponsor_1_logo: sponsor1Logo, sponsor_1_url: sponsor1Url, sponsor_1_name: sponsor1Name,
              sponsor_2_logo: sponsor2Logo, sponsor_2_url: sponsor2Url, sponsor_2_name: sponsor2Name,
              sponsor_3_logo: sponsor3Logo, sponsor_3_url: sponsor3Url, sponsor_3_name: sponsor3Name,
              sponsor_4_logo: sponsor4Logo, sponsor_4_url: sponsor4Url, sponsor_4_name: sponsor4Name
            }).eq("team_id", teamId)
          );
        }
''', '''
        if (hasFeature(clubRecord, 'SPONSORS')) {
           // We already saved sponsors above
        }
''')

# Only show active sponsors
content = content.replace('sponsors.map((s, index) => (', 'sponsors.filter(s => s.is_active).map((s, index) => (')

with open("components/Setup.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
