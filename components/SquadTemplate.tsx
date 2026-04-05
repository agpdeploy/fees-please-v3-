interface SquadTemplateProps {
  clubName: string;
  logo: string;
  opponent: string;
  matchDate: string;
  matchTime: string;
  squad: any[];
  notes: string;
  themeColor: string;
  // Make sure this exact line has " | null" added to it:
  innerRef: React.RefObject<HTMLDivElement | null>; 
}
export default function SquadTemplate({ 
  clubName, logo, opponent, matchDate, matchTime, squad, notes, themeColor, innerRef 
}: SquadTemplateProps) {
  return (
    <div 
      ref={innerRef}
      className="w-[1080px] h-[1080px] bg-zinc-950 grid grid-cols-2 grid-rows-2 overflow-hidden text-white border-[12px] border-zinc-900"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* 1. TOP LEFT: LOGO BOX */}
      <div 
        className="flex items-center justify-center p-12 relative"
        style={{ backgroundColor: themeColor }}
      >
        {/* Subtle Halftone Pattern Overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #000 1.5px, transparent 0)', backgroundSize: '12px 12px' }}></div>
        
        {logo ? (
          <img src={logo} className="w-64 h-64 object-contain relative z-10 drop-shadow-2xl" alt="Club Logo" />
        ) : (
          <div className="text-9xl font-black italic tracking-tighter text-black/20 select-none uppercase">
            {clubName.substring(0, 2)}
          </div>
        )}
      </div>

      {/* 2. TOP RIGHT: MATCH INFO */}
      <div className="bg-zinc-900/50 flex flex-col justify-center p-12 border-l border-zinc-800 relative">
        <div className="absolute top-0 right-0 p-8 text-zinc-800 font-black text-8xl">VS</div>
        
        <div className="relative z-10">
          <div className="bg-yellow-500 text-black inline-block px-4 py-1 font-black uppercase text-2xl mb-4 italic">
            Next Fixture
          </div>
          <h2 className="text-6xl font-black uppercase leading-none mb-4 italic">
            {opponent || 'TBA'}
          </h2>
          <div className="text-4xl font-black tracking-tighter" style={{ color: themeColor }}>
            {matchTime} | {matchDate}
          </div>
          
          {notes && (
            <div className="mt-8 pt-8 border-t border-zinc-800">
              <p className="text-zinc-400 font-bold uppercase text-sm tracking-[0.2em] mb-2">Instructions</p>
              <p className="text-xl font-medium leading-tight text-zinc-200 uppercase">{notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. BOTTOM LEFT: HERO IMAGE / ACCENT */}
      <div className="relative overflow-hidden group border-t border-zinc-800">
        {/* If you have a team photo URL, put it here. Otherwise, a cool gradient with club name. */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center p-12">
            <h1 className="text-[12rem] font-black text-white/5 uppercase italic leading-none text-center">
                {clubName}
            </h1>
            <div className="absolute bottom-12 left-12">
                <p className="text-xs font-black uppercase tracking-[0.5em] text-zinc-500">Fees Please | GameDay</p>
            </div>
        </div>
      </div>

      {/* 4. BOTTOM RIGHT: SQUAD LIST */}
      <div 
        className="p-12 border-t border-l border-zinc-800 relative"
        style={{ backgroundColor: '#0c0c0e' }}
      >
         {/* Halftone accent in corner */}
         <div className="absolute bottom-0 right-0 w-64 h-64 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 0)', backgroundSize: '16px 16px' }}></div>

         <div className="grid grid-cols-1 gap-y-4">
            {squad.slice(0, 11).map((player, i) => (
              <div key={player.id} className="flex items-center gap-4 border-b border-zinc-900 pb-2">
                <span className="text-2xl font-black w-10 italic" style={{ color: themeColor }}>
                    {(i + 1).toString().padStart(2, '0')}
                </span>
                <span className="text-3xl font-black uppercase tracking-tight">
                    {player.first_name} {player.last_name}
                </span>
                {i === 0 && (
                    <span className="ml-auto text-[10px] font-black border border-zinc-700 px-2 py-0.5 rounded text-zinc-500 uppercase">C</span>
                )}
              </div>
            ))}
            
            {/* Handle empty slots if squad < 11 */}
            {Array.from({ length: Math.max(0, 11 - squad.length) }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-zinc-900 pb-2 opacity-20">
                <span className="text-2xl font-black w-10 italic">{(squad.length + i + 1).toString().padStart(2, '0')}</span>
                <span className="text-3xl font-black uppercase tracking-tight italic">TBC...</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}