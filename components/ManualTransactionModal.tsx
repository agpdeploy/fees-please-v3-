"use client";

import { useState, useEffect } from "react";

interface Player {
  id: string;
  first_name: string;
  last_name: string | null;
  nickname: string | null;
}

interface Fixture {
  id: string;
  opponent: string;
  match_date: string;
}

interface ManualTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    type: 'payment' | 'credit' | 'fee';
    playerId: string;
    fixtureId: string;
    amount: number;
    note: string;
  }) => Promise<void>;
  players: Player[];
  fixtures: Fixture[];
  preselectedPlayerId?: string;
}

export default function ManualTransactionModal({
  isOpen,
  onClose,
  onSave,
  players,
  fixtures,
  preselectedPlayerId
}: ManualTransactionModalProps) {
  const [type, setType] = useState<'payment' | 'credit' | 'fee'>('payment');
  const [playerId, setPlayerId] = useState<string>("team");
  const [fixtureId, setFixtureId] = useState<string>("");
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setType('payment');
      setPlayerId(preselectedPlayerId || "team");
      setFixtureId("");
      setAmount("");
      setNote("");
      setSearch("");
      setIsSaving(false);
      setIsDropdownOpen(false);
    }
  }, [isOpen, preselectedPlayerId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isSaving) return;
    setIsSaving(true);
    await onSave({
      type,
      playerId,
      fixtureId,
      amount: Number(amount),
      note
    });
    setIsSaving(false);
    onClose();
  };

  const filteredPlayers = players.filter(p => {
    const term = search.toLowerCase();
    const formatted = p.nickname || (p.last_name ? `${p.first_name} ${p.last_name.charAt(0)}.` : p.first_name);
    return formatted.toLowerCase().includes(term);
  });

  const getSelectedPlayerName = () => {
    if (playerId === "team") return "No Player (Team Expense/Revenue)";
    const p = players.find(x => x.id === playerId);
    if (!p) return "Select Player...";
    return p.nickname || (p.last_name ? `${p.first_name} ${p.last_name.charAt(0)}.` : p.first_name);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in transition-opacity"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div className="relative bg-white dark:bg-[#111] rounded-t-3xl shadow-2xl w-full max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Drag handle & Header */}
        <div className="shrink-0 pt-3 pb-4 px-6 border-b border-zinc-100 dark:border-zinc-800/50 flex flex-col items-center">
          <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-4" />
          <div className="w-full flex justify-between items-center">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">
              Manual Transaction
            </h2>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          
          {/* Type Toggle */}
          <div className="flex bg-zinc-100 dark:bg-[#222] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1.5 transition-colors">
            <button 
              type="button" 
              onClick={() => setType('payment')} 
              className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'payment' ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Money In (+)
            </button>
            <button 
              type="button" 
              onClick={() => setType('credit')} 
              className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'credit' ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Credit
            </button>
            <button 
              type="button" 
              onClick={() => setType('fee')} 
              className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'fee' ? 'bg-white dark:bg-zinc-700 text-red-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Money Out (-)
            </button>
          </div>

          {/* Player Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Player</label>
            {!isDropdownOpen ? (
              <button 
                type="button"
                onClick={() => setIsDropdownOpen(true)}
                className="w-full bg-zinc-50 dark:bg-[#222] border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm text-zinc-900 dark:text-white font-bold flex justify-between items-center shadow-sm"
              >
                <span>{getSelectedPlayerName()}</span>
                <i className="fa-solid fa-chevron-down text-zinc-400 text-[10px]"></i>
              </button>
            ) : (
              <div className="bg-zinc-50 dark:bg-[#222] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="relative border-b border-zinc-200 dark:border-zinc-800">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Search existing players..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-transparent pl-10 pr-10 py-4 text-xs font-bold text-zinc-900 dark:text-white outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 w-6 h-6 flex items-center justify-center"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => { setPlayerId("team"); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${playerId === "team" ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'}`}
                  >
                    <i className="fa-solid fa-users w-4 text-center"></i>
                    -- No Player (Team Expense / Revenue) --
                  </button>
                  {filteredPlayers.map(p => {
                    const formatted = p.nickname || (p.last_name ? `${p.first_name} ${p.last_name.charAt(0)}.` : p.first_name);
                    const isSelected = playerId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setPlayerId(p.id); setIsDropdownOpen(false); }}
                        className={`w-full text-left px-5 py-3 text-sm font-bold flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${isSelected ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50'}`}
                      >
                        <span>{formatted}</span>
                        {isSelected && <i className="fa-solid fa-check text-emerald-500"></i>}
                      </button>
                    );
                  })}
                  {filteredPlayers.length === 0 && (
                    <div className="px-5 py-6 text-center text-zinc-400 text-[10px] uppercase font-black tracking-widest">
                      No players found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Match & Note */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Fixture (Optional)</label>
              <div className="relative">
                <select 
                  value={fixtureId} 
                  onChange={e => setFixtureId(e.target.value)} 
                  className="w-full bg-zinc-50 dark:bg-[#222] border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm text-zinc-900 dark:text-white outline-none font-bold appearance-none shadow-sm"
                >
                  <option value="">-- Unassigned --</option>
                  {fixtures.map(f => (
                    <option key={f.id} value={f.id}>
                      vs {f.opponent} ({new Date(f.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                    </option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px] pointer-events-none"></i>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Note</label>
              <input 
                type="text" 
                placeholder="e.g. Fine, Cash, Refund" 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-[#222] border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-colors shadow-sm" 
              />
            </div>
          </div>

          {/* Amount (Big style) */}
          <div className="bg-zinc-50 dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex justify-between items-center transition-colors">
            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest w-24 leading-tight">
              Amount<br/>{type === 'fee' ? 'Due' : (type === 'credit' ? 'Credited' : 'Paid')}
            </span>
            <div className="flex-1 flex justify-end items-center relative">
              <span className={`absolute right-[calc(100%-1rem)] top-1/2 -translate-y-1/2 text-xl font-black mr-2 ${!amount ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-900 dark:text-white'}`}>$</span>
              <input 
                type="number" 
                placeholder="0.00" 
                value={amount} 
                onChange={e => setAmount(Number(e.target.value))} 
                className={`bg-transparent text-right text-4xl font-black outline-none w-32 ${type === 'fee' ? 'text-red-500' : (type === 'credit' ? 'text-blue-500' : 'text-emerald-500')}`} 
                required 
              />
            </div>
          </div>

        </div>

        {/* Fixed Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-[#111] rounded-b-3xl">
          <button 
            type="button" 
            onClick={handleSubmit}
            disabled={isSaving || !amount} 
            className="w-full py-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</>
            ) : (
              <><i className="fa-solid fa-check"></i> Save Transaction</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
