import { supabase } from './supabase';
import { toPng } from 'html-to-image';

export async function uploadSquadGraphic(node: HTMLElement, fixtureId: string) {
  try {
    // 1. Generate Image with a much safer filter
    const dataUrl = await toPng(node, { 
      quality: 0.95, 
      cacheBust: true,
      skipFonts: true, // Helps bypass external font CORS issues
      filter: (el: unknown) => {
        const element = el as HTMLElement;
        // Safely ignore FontAwesome or any external CDNs
        if (element?.tagName === 'LINK') {
          const href = (element as HTMLLinkElement).href || '';
          if (href.includes('font-awesome') || href.includes('cdnjs')) {
            return false;
          }
        }
        return true;
      }
    });

    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const fileName = `squad_${fixtureId}_${Date.now()}.png`;

    // 2. Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('squad-graphics')
      .upload(fileName, blob, { 
        contentType: 'image/png', 
        upsert: true 
      });

    if (error) {
      console.error("Supabase Error:", error.message);
      throw error;
    }

    // 3. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('squad-graphics')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.error("Upload/Generate Error:", err);
    throw err;
  }
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