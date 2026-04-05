import { supabase } from './supabase';
import { toPng } from 'html-to-image';

export async function uploadSquadGraphic(node: HTMLElement, fixtureId: string) {
  try {
    const dataUrl = await toPng(node, { 
      quality: 0.95, 
      cacheBust: true,
      skipFonts: true, 
      filter: (el: unknown) => {
        const element = el as HTMLElement;
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

    const { error } = await supabase.storage
      .from('squad-graphics')
      .upload(fileName, blob, { 
        contentType: 'image/png', 
        upsert: true 
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('squad-graphics')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.error("Upload/Generate Error:", err);
    throw err;
  }
}

export async function shareSquadGraphic(players: any[], opponent: string, graphicUrl: string, matchTime: string, matchLocation: string, notes: string) {
  const teamList = players
    .map((p, i) => `${i + 1}. ${p.first_name} ${p.last_name}`)
    .join('\n');

  const timeString = matchTime ? `\nTime: ${matchTime}` : '';
  const locString = matchLocation ? `\nLocation: ${matchLocation}` : '';
  const notesString = notes ? `\n\nNotes:\n${notes}` : '';

  const shareData = {
    title: `Match Squad vs ${opponent}`,
    text: `🏏 MATCH SQUAD\nvs ${opponent}${timeString}${locString}\n\n${teamList}${notesString}\n\nView Graphic:\n`,
    url: graphicUrl,
  };

  if (navigator.share && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return { success: true, method: 'native' };
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err;
      return { success: false, method: 'cancelled' };
    }
  } else {
    const fullText = `${shareData.text} ${shareData.url}`;
    await navigator.clipboard.writeText(fullText);
    return { success: true, method: 'clipboard' };
  }
}