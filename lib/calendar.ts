// Helper functions for calendar integration

function parseDateTime(dateStr: string, timeStr?: string): { start: Date, end: Date } | null {
  try {
    // dateStr is usually YYYY-MM-DD
    if (!dateStr) return null;
    
    // Default to 12:00 PM if no time provided
    let hours = 12;
    let minutes = 0;
    
    if (timeStr) {
      // Handle HH:MM:SS or HH:MM AM/PM
      const isPM = timeStr.toLowerCase().includes('pm');
      const isAM = timeStr.toLowerCase().includes('am');
      
      const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
      }
    }
    
    // SAFE PARSING OF DATE
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    let year, month, day;
    
    if (dateMatch) {
      year = parseInt(dateMatch[1], 10);
      month = parseInt(dateMatch[2], 10);
      day = parseInt(dateMatch[3], 10);
    } else {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }
    
    // Create Date object in local time
    const start = new Date(year, month - 1, day, hours, minutes);
    if (isNaN(start.getTime())) return null;
    
    // Default duration: 2 hours
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    
    return { start, end };
  } catch (e) {
    console.error("Error parsing date/time for calendar", e);
    return null;
  }
}

function formatGoogleDate(date: Date): string {
  // Format: YYYYMMDDTHHMMSS (Floating time, no Z)
  // This uses local getters which are deterministic between server and client, preventing React Hydration Mismatches
  // Floating time tells Google Calendar to use the user's local timezone
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}`;
}

function formatIcsDate(date: Date): string {
  // Floating time format (no Z) - adapts to the user's local timezone
  // For sports, we want 7PM local time to be 7PM wherever the user is
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}`;
}

export function getGoogleCalendarUrl(fixture: any, teamName: string): string {
  if (!fixture || !fixture.match_date) return '#';
  
  const parsed = parseDateTime(fixture.match_date, fixture.start_time);
  if (!parsed) return '#';
  
  const title = `${teamName} vs ${fixture.opponent}`;
  const location = fixture.location || '';
  const description = `Match: ${teamName} vs ${fixture.opponent}
Manage your availability: ${(process.env.NEXT_PUBLIC_BASE_URL || 'https://feesplease.com')}/t/${fixture.team_slug || 'team'}`;
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatGoogleDate(parsed.start)}/${formatGoogleDate(parsed.end)}`,
    details: description,
    location: location
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getIcsData(fixture: any, teamName: string): string {
  if (!fixture || !fixture.match_date) return '';
  
  const parsed = parseDateTime(fixture.match_date, fixture.start_time);
  if (!parsed) return '';
  
  const title = `${teamName} vs ${fixture.opponent}`;
  const location = fixture.location || '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://feesplease.app';
  const teamHubUrl = `${baseUrl}/t/${fixture.team_slug || 'team'}`;
  
  // Plain text description
  const description = `Match: ${teamName} vs ${fixture.opponent}\\n` +
    (fixture.start_time ? `Time: ${fixture.start_time}\\n` : '') +
    (fixture.location ? `Location: ${fixture.location}\\n\\n` : '\\n') +
    `Manage your availability:\\n${teamHubUrl}\\n\\n` +
    `Powered By Fees Please\\nhttps://feesplease.app`;

  // HTML description for rich email/calendar clients
  const htmlDescription = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2//EN"><HTML><BODY>` +
    `<p><b>Match:</b> ${teamName} vs ${fixture.opponent}<br>` +
    (fixture.start_time ? `<b>Time:</b> ${fixture.start_time}<br>` : '') +
    (fixture.location ? `<b>Location:</b> ${fixture.location}</p>` : '</p>') +
    `<p><b>Manage your availability:</b><br><a href="${teamHubUrl}">${teamHubUrl}</a></p>` +
    `<p><em>Powered By Fees Please</em><br><a href="https://feesplease.app">https://feesplease.app</a></p>` +
    `</BODY></HTML>`;
  
  // Format as ICS standard
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'METHOD:PUBLISH',
    'PRODID:-//Fees Please//Team Availability//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `SUMMARY:${title}`,
    `DTSTART:${formatIcsDate(parsed.start)}`,
    `DTEND:${formatIcsDate(parsed.end)}`,
    `LOCATION:${location}`,
    `URL:${teamHubUrl}`,
    `DESCRIPTION:${description}`,
    `X-ALT-DESC;FMTTYPE=text/html:${htmlDescription}`,
    `UID:fixture-${fixture.id}@feesplease.com`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  
  return icsLines.join('\r\n');
}
