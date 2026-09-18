function parseDateTime(dateStr, timeStr) {
  try {
    if (!dateStr) return null;
    
    let hours = 12;
    let minutes = 0;
    
    if (timeStr) {
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
    // Match YYYY-MM-DD anywhere in the string
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    let year, month, day;
    
    if (dateMatch) {
      year = parseInt(dateMatch[1], 10);
      month = parseInt(dateMatch[2], 10);
      day = parseInt(dateMatch[3], 10);
    } else {
      // Fallback
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }
    
    const start = new Date(year, month - 1, day, hours, minutes);
    if (isNaN(start.getTime())) return null;
    
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return { start, end };
  } catch (e) {
    return null;
  }
}

console.log(parseDateTime('2026-09-17', '10:00 AM'));
console.log(parseDateTime('2026-09-17T00:00:00.000Z', '7:30 PM'));
console.log(parseDateTime('invalid date', '10:00 AM'));
