"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  secondaryInfo?: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  isLoading?: boolean;
  onClick?: () => void;
}

export default function StatCard({ title, value, subtitle, secondaryInfo, icon, gradientFrom, gradientTo, isLoading, onClick }: StatCardProps) {
  return (
    <div 
         onClick={onClick}
         className={`p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group transition-transform duration-300 shadow-sm ${onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md' : 'hover:scale-[1.02]'}`}
         style={{ background: `linear-gradient(135deg, ${gradientFrom}15, ${gradientTo}05)` }}>
      
      {/* Decorative Background Blob */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40" 
           style={{ background: gradientFrom }}></div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{title}</h3>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm"
             style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
          <i className={`fa-solid ${icon} text-sm`}></i>
        </div>
      </div>
      
      <div className="relative z-10">
        {isLoading ? (
          <div className="h-10 w-24 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-lg mb-1"></div>
        ) : (
          <div className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">
            {value}
          </div>
        )}
        
        {subtitle && (
          <div className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-wider">
            {subtitle}
          </div>
        )}
        
        {secondaryInfo && (
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-0.5 uppercase tracking-wider">
            {secondaryInfo}
          </div>
        )}
      </div>
    </div>
  );
}
