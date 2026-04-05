interface SquadTemplateProps {
  clubName: string;
  logo: string;
  opponent: string;
  matchDate: string;
  matchTime: string;
  matchLocation: string;
  squad: any[];
  notes: string;
  themeColor: string;
  innerRef: React.RefObject<HTMLDivElement | null>;
}

export default function SquadTemplate({ 
  clubName, logo, opponent, matchDate, matchTime, matchLocation, squad, notes, themeColor, innerRef 
}: SquadTemplateProps) {
  return (
    <div 
      ref={innerRef}
      className="w-[1080px] h-[1350px] relative overflow-hidden text-white flex flex-col"
      style={{ fontFamily: 'Inter, sans-serif', backgroundColor: themeColor || '#144d36' }}
    >
      {/* Halftone Dot Overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 0)', backgroundSize: '16px 16px' }}></div>

      {/* Top Section Split */}
      <div className="flex h-[450px]">
        {/* Top Left: Logo */}
        <div className="w-1/2 flex items-center justify-center p-12 relative z-10">
          {logo ? (
            <img src={logo} crossOrigin="anonymous" className="w-[300px] h-[300px] object-contain drop-shadow-2xl" alt="Club Logo" />
          ) : (
            <div className="text-8xl font-black italic tracking-tighter text-white/20 uppercase">
              {clubName.substring(0, 2)}
            </div>
          )}
        </div>

        {/* Top Right: Match Info Box */}
        <div className="w-1/2 bg-[#6b2133] relative flex flex-col items-center justify-center p-8 text-center border-l-4 border-black/20 z-10 shadow-2xl">
          {/* Big VS Watermark */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none opacity-20">
            <span className="text-[250px] font-black text-black tracking-tighter leading-none -mt-10">VS</span>
          </div>

          <div className="bg-[#fbbf24] text-black px-6 py-2 mb-4 relative z-20 shadow-lg">
            <h2 className="text-4xl font-black uppercase tracking-widest">{opponent || 'TBA'}</h2>
          </div>
          
          <div className="text-[#fbbf24] text-5xl font-black uppercase tracking-tighter mb-4 relative z-20 drop-shadow-md">
            {matchTime || 'TBA'} {matchDate}
          </div>

          <div className="relative z-20 mt-2 space-y-4">
            {matchLocation && (
              <p className="text-white text-xl font-bold uppercase tracking-widest">{matchLocation}</p>
            )}
            {notes && (
              <p className="text-white text-lg font-medium uppercase tracking-wider max-w-sm mx-auto opacity-90 leading-snug">
                {notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Players */}
      <div className="flex-1 p-16 pl-24 relative z-10 flex flex-col justify-center">
         <div className="space-y-3">
            {squad.map((player, i) => (
              <div key={player.id} className="flex items-center">
                <span className="text-5xl font-black uppercase text-[#fbbf24] tracking-tight drop-shadow-md">
                    {player.first_name} {player.last_name}
                </span>
                {i === 0 && (
                    <span className="ml-4 text-xl font-black bg-white/20 px-3 py-1 rounded text-white uppercase tracking-widest">C</span>
                )}
              </div>
            ))}
         </div>
      </div>

      {/* Footer / Sponsor */}
      <div className="p-16 pl-24 relative z-10 opacity-80 pb-20">
        <div className="flex items-center gap-4">
          <div className="text-6xl font-black uppercase tracking-tighter leading-none">FEES</div>
          <div className="h-12 w-1 bg-white/50"></div>
          <div className="text-3xl font-bold uppercase tracking-widest leading-none">PLEASE<br/>APP</div>
        </div>
      </div>
    </div>
  );
}