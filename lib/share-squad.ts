import { supabase } from './supabase';
import { toPng } from 'html-to-image';

export async function uploadSquadGraphic(node: HTMLElement, fixtureId: string) {
  // 1. Generate Blob from the hidden div (with FontAwesome filter)
  const dataUrl = await toPng(node, { 
    quality: 0.95, 
    cacheBust: true,
    filter: (el: any) => {
      // Skip external FontAwesome stylesheets to prevent CORS crashes
      if (el?.tagName === 'LINK' && el?.href?.includes('font-awesome')) {
        return false;
      }
      return true;
    }
  });
  
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  const fileName = `squad_${fixtureId}_${Date.now()}.png`;
  const filePath = `public/${fileName}`;

  // 2. Upload to Supabase Storage
  const { error } = await supabase.storage
    .from('squad-graphics')
    .upload(filePath, blob, { contentType: 'image/png', upsert: true });

  if (error) throw error;

  // 3. Get Public URL
  const { data: { publicUrl } } = supabase.storage
    .from('squad-graphics')
    .getPublicUrl(filePath);

  return publicUrl;
}

export function generateWhatsAppLink(players: any[], opponent: string, graphicUrl: string, matchTime: string, notes: string) {
  const teamList = players
    .map((p, i) => `${i + 1}. ${p.first_name} ${p.last_name}`)
    .join('\n');

  const timeString = matchTime ? `\n*Time:* ${matchTime}` : '';
  const notesString = notes ? `\n\n*Captain's Note:*\n${notes}` : '';

  const message = encodeURIComponent(
    `🏏 *FEES PLEASE - MATCH SQUAD*\n` +
    `vs ${opponent}${timeString}\n\n` +
    `${teamList}${notesString}\n\n` +
    `📸 View Match Graphic:\n${graphicUrl}`
  );

  return `https://wa.me/?text=${message}`;
}