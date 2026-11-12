import React, { useRef, useState } from 'react';
import { Camera, Flame, Pencil, Check } from 'lucide-react';
import { Memory, OfrendaProfile } from '../types';
import { Candle } from './Candle';

interface AltarProps {
  profile: OfrendaProfile;
  memories: Memory[];
  strengthsById: Record<string, number>;
  selectedMemoryId: string | null;
  newlyAddedId: string | null;
  rekindledId: string | null;
  reducedMotion: boolean;
  onSelectMemory: (memory: Memory) => void;
  onUpdateProfile: (updates: Partial<OfrendaProfile>) => void;
  onOpenAddModal: () => void;
}

const MarigoldCluster: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 64 36"
    className={`w-12 h-7 pointer-events-none select-none ${className}`}
    aria-hidden="true"
  >
    <g>
      <circle cx="18" cy="21" r="10" fill="#d97706" fillOpacity="0.85" />
      <circle cx="18" cy="20" r="7" fill="#ff9f1c" />
      <circle cx="18" cy="19" r="3.5" fill="#fde047" />

      <circle cx="34" cy="17" r="12" fill="#b45309" fillOpacity="0.9" />
      <circle cx="34" cy="16" r="8.5" fill="#ff9f1c" />
      <circle cx="34" cy="15" r="4.5" fill="#fef08a" />

      <circle cx="48" cy="22" r="9.5" fill="#d97706" fillOpacity="0.85" />
      <circle cx="48" cy="21" r="6.5" fill="#fb923c" />
      <circle cx="48" cy="20" r="3" fill="#fde047" />
    </g>
  </svg>
);

export const Altar: React.FC<AltarProps> = ({
  profile,
  memories,
  strengthsById,
  selectedMemoryId,
  newlyAddedId,
  rekindledId,
  reducedMotion,
  onSelectMemory,
  onUpdateProfile,
  onOpenAddModal,
}) => {
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const [portraitError, setPortraitError] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(profile.honoreeName);
  const [draftEpitaph, setDraftEpitaph] = useState(profile.epitaph);

  const handlePortraitUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPortraitError(false);
        onUpdateProfile({ portraitBase64: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const saveHonoreeDetails = () => {
    onUpdateProfile({
      honoreeName: draftName.trim() || 'Someone Remembered',
      epitaph: draftEpitaph.trim(),
    });
    setIsEditingName(false);
  };

  // Distribute memories thoughtfully across the 3 altar levels
  const tier1Memories: Memory[] = [];
  const tier2Memories: Memory[] = [];
  const tier3Memories: Memory[] = [];

  memories.forEach((m, index) => {
    if (m.tier === 1 && tier1Memories.length < 4) {
      tier1Memories.push(m);
    } else if (m.tier === 2 && tier2Memories.length < 6) {
      tier2Memories.push(m);
    } else if (m.tier === 3) {
      tier3Memories.push(m);
    } else {
      // Balanced overflow distribution across tiers
      const mod = index % 3;
      if (mod === 0 && tier1Memories.length < 4) tier1Memories.push(m);
      else if (mod === 1) tier2Memories.push(m);
      else tier3Memories.push(m);
    }
  });

  const leftPortraitCandles = tier1Memories.filter((_, i) => i % 2 === 0);
  const rightPortraitCandles = tier1Memories.filter((_, i) => i % 2 === 1);

  const isEmpty = memories.length === 0;

  return (
    <section
      aria-label="Three-tiered Día de los Muertos Ofrenda"
      className="relative w-full max-w-4xl mx-auto pt-2 pb-6 px-3 sm:px-6 flex flex-col items-center"
    >
      {/* Honoree Dedication Header */}
      <div className="mb-5 text-center max-w-xl">
        {isEditingName ? (
          <div className="flex flex-col items-center gap-2 bg-[#14112a]/90 border border-[#ff9f1c]/35 rounded-lg px-4 py-3">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              aria-label="Loved one's name"
              placeholder="Name of someone remembered"
              className="bg-[#0b0a1a] border border-[#f5f0e6]/20 rounded px-3 py-1 text-center font-serif text-xl text-[#f5f0e6] focus:outline-none focus:border-[#ff9f1c]"
            />
            <input
              type="text"
              value={draftEpitaph}
              onChange={(e) => setDraftEpitaph(e.target.value)}
              aria-label="Dedication or years"
              placeholder="Years or a quiet dedication"
              className="w-72 sm:w-80 bg-[#0b0a1a] border border-[#f5f0e6]/15 rounded px-3 py-1 text-center text-xs text-[#f5f0e6]/75 focus:outline-none focus:border-[#ff9f1c]"
            />
            <button
              type="button"
              onClick={saveHonoreeDetails}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#ff9f1c] text-[#0b0a1a] text-xs font-medium hover:bg-[#ffbf69] transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Save Dedication
            </button>
          </div>
        ) : (
          <div className="group inline-flex flex-col items-center">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-medium tracking-wide text-[#f5f0e6] [text-wrap:balance]">
                {profile.honoreeName}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setDraftName(profile.honoreeName);
                  setDraftEpitaph(profile.epitaph);
                  setIsEditingName(true);
                }}
                aria-label="Edit honoree name and dedication"
                className="p-1.5 rounded-md text-[#f5f0e6]/40 hover:text-[#ff9f1c] hover:bg-[#f5f0e6]/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c] cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            {profile.epitaph && (
              <p className="mt-1 text-xs sm:text-sm text-[#f5f0e6]/65 font-light tracking-wide">
                {profile.epitaph}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ================= TIER 1 (TOP LEVEL: PORTRAIT & FLANKING CANDLES) ================= */}
      <div className="relative w-[84%] sm:w-[72%] flex flex-col items-center z-20">
        {/* Items resting on Tier 1 */}
        <div className="w-full flex items-end justify-center gap-3 sm:gap-6 px-2 pb-1 min-h-[175px]">
          {/* Left flanking candles */}
          <div className="hidden sm:flex items-end gap-2">
            {leftPortraitCandles.map((mem) => (
              <Candle
                key={mem.id}
                memory={mem}
                strength={strengthsById[mem.id] ?? 1}
                isSelected={selectedMemoryId === mem.id}
                isNewlyAdded={newlyAddedId === mem.id}
                isRekindled={rekindledId === mem.id}
                reducedMotion={reducedMotion}
                onSelect={onSelectMemory}
              />
            ))}
          </div>

          {/* Center Glowing Portrait Frame with Marigold Petals */}
          <div className="relative flex flex-col items-center mx-2">
            {/* Soft warm halo behind portrait */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-5 rounded-full bg-gradient-to-b from-[#ff9f1c]/25 via-amber-500/15 to-transparent blur-xl"
            />

            {/* Ornate brass & carved wood frame */}
            <div className="relative group rounded-t-[48px] rounded-b-lg p-2 bg-gradient-to-b from-[#e6a947] via-[#9b621c] to-[#5e380d] shadow-[0_0_32px_rgba(255,159,28,0.28)] border border-amber-200/40">
              <div className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-t-[40px] rounded-b-sm overflow-hidden bg-[#161329] border border-[#0b0a1a]/70">
                {profile.portraitBase64 && !portraitError ? (
                  <img
                    src={profile.portraitBase64}
                    alt={`Portrait of ${profile.honoreeName}`}
                    referrerPolicy="no-referrer"
                    onError={() => setPortraitError(true)}
                    className="w-full h-full object-cover object-top sepia-[0.12] contrast-[1.03]"
                  />
                ) : (
                  /* Resilient fallback if no portrait or load failure */
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-[#231d3d] to-[#110e22]">
                    <Flame className="w-7 h-7 text-[#ff9f1c]/70 mb-1.5" />
                    <span className="font-serif text-xs text-[#f5f0e6]/80 leading-tight">
                      {profile.honoreeName}
                    </span>
                  </div>
                )}

                {/*Measured dark scrim on hover to upload custom portrait */}
                <button
                  type="button"
                  onClick={() => portraitInputRef.current?.click()}
                  aria-label="Upload portrait photograph for the ofrenda"
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-end pb-3 px-2 text-center focus:outline-none cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#ffbf69] mb-1" />
                  <span className="text-[11px] font-medium text-[#f5f0e6] whitespace-nowrap">
                    Change Portrait
                  </span>
                </button>
              </div>

              <input
                ref={portraitInputRef}
                type="file"
                accept="image/*"
                onChange={handlePortraitUpload}
                className="hidden"
              />

              {/* Marigold clusters framing the base of the portrait */}
              <MarigoldCluster className="absolute -bottom-3 -left-6 -rotate-6" />
              <MarigoldCluster className="absolute -bottom-3 -right-6 rotate-6 scale-x-[-1]" />
            </div>
          </div>

          {/* Right flanking candles */}
          <div className="hidden sm:flex items-end gap-2">
            {rightPortraitCandles.map((mem) => (
              <Candle
                key={mem.id}
                memory={mem}
                strength={strengthsById[mem.id] ?? 1}
                isSelected={selectedMemoryId === mem.id}
                isNewlyAdded={newlyAddedId === mem.id}
                isRekindled={rekindledId === mem.id}
                reducedMotion={reducedMotion}
                onSelect={onSelectMemory}
              />
            ))}
          </div>
        </div>

        {/* Tier 1 Altar Ledge (Embroidered plum/indigo runner over carved cedar) */}
        <div className="w-full h-7 rounded-t-md bg-gradient-to-b from-[#2b1f42] to-[#191229] border-t border-x border-[#ff9f1c]/35 shadow-[0_10px_24px_rgba(0,0,0,0.75)] relative overflow-hidden">
          <div
            aria-hidden="true"
            className="w-full h-1.5 bg-gradient-to-r from-transparent via-[#ff9f1c]/45 to-transparent"
          />
          <div
            aria-hidden="true"
            className="mt-1.5 w-full border-t border-dashed border-[#c85a8e]/35"
          />
        </div>
      </div>

      {/* ================= TIER 2 (MIDDLE LEVEL: CANDLES OR LONE UNLIT CANDLE EMPTY STATE) ================= */}
      <div className="relative w-[92%] sm:w-[86%] flex flex-col items-center z-15 -mt-1">
        <div className="w-full min-h-[118px] px-3 sm:px-6 pt-3 pb-1 flex flex-wrap items-end justify-center gap-2 sm:gap-5">
          {/* Render mobile Tier 1 overflow on Tier 2 so no candle is ever hidden on mobile */}
          <div className="flex sm:hidden items-end gap-2">
            {tier1Memories.map((mem) => (
              <Candle
                key={mem.id}
                memory={mem}
                strength={strengthsById[mem.id] ?? 1}
                isSelected={selectedMemoryId === mem.id}
                isNewlyAdded={newlyAddedId === mem.id}
                isRekindled={rekindledId === mem.id}
                reducedMotion={reducedMotion}
                onSelect={onSelectMemory}
              />
            ))}
          </div>

          {isEmpty ? (
            /* 7. Empty state: a lone unlit candle with touching invitation */
            <div className="flex flex-col items-center py-2 text-center">
              <button
                type="button"
                onClick={onOpenAddModal}
                aria-label="Light the first candle for someone you remember"
                className="group flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c] rounded-lg px-4 py-2 cursor-pointer"
              >
                {/* Lone unlit candle */}
                <div className="w-[2px] h-2.5 bg-stone-500 rounded-t-full group-hover:bg-[#ff9f1c] transition-colors" />
                <div className="w-7 h-12 rounded-t-[5px] rounded-b-[3px] bg-gradient-to-b from-stone-400/70 via-stone-600/75 to-stone-800/90 border border-[#f5f0e6]/15 shadow-md group-hover:border-[#ff9f1c]/50 transition-colors" />
                <div className="w-10 h-1.5 rounded-full bg-amber-900/70" />
                <p className="mt-3 font-serif italic text-base sm:text-lg text-[#f5f0e6]/85 group-hover:text-[#ffbf69] transition-colors max-w-xs">
                  Light the first candle for someone you remember.
                </p>
              </button>
            </div>
          ) : (
            tier2Memories.map((mem) => (
              <Candle
                key={mem.id}
                memory={mem}
                strength={strengthsById[mem.id] ?? 1}
                isSelected={selectedMemoryId === mem.id}
                isNewlyAdded={newlyAddedId === mem.id}
                isRekindled={rekindledId === mem.id}
                reducedMotion={reducedMotion}
                onSelect={onSelectMemory}
              />
            ))
          )}
        </div>

        {/* Tier 2 Altar Ledge */}
        <div className="w-full h-8 rounded-t-md bg-gradient-to-b from-[#261b3b] to-[#150f24] border-t border-x border-[#ff9f1c]/30 shadow-[0_12px_28px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div
            aria-hidden="true"
            className="w-full h-1.5 bg-gradient-to-r from-transparent via-[#c85a8e]/45 to-transparent"
          />
          <div
            aria-hidden="true"
            className="mt-2 w-full border-t border-dashed border-[#ff9f1c]/25"
          />
        </div>
      </div>

      {/* ================= TIER 3 (LOWER SANCTUARY STEP: OLDER / FADING CANDLES & MARIGOLD ARCH) ================= */}
      <div className="relative w-full flex flex-col items-center z-10 -mt-1">
        <div className="w-full min-h-[112px] px-4 sm:px-8 pt-3 pb-1 flex flex-wrap items-end justify-center gap-3 sm:gap-6">
          <MarigoldCluster className="hidden md:block opacity-85 mb-0.5" />

          {tier3Memories.map((mem) => (
            <Candle
              key={mem.id}
              memory={mem}
              strength={strengthsById[mem.id] ?? 1}
              isSelected={selectedMemoryId === mem.id}
              isNewlyAdded={newlyAddedId === mem.id}
              isRekindled={rekindledId === mem.id}
              reducedMotion={reducedMotion}
              onSelect={onSelectMemory}
            />
          ))}

          {/* Quiet Copal Incense Chalice SVG accent */}
          {!isEmpty && (
            <div
              aria-hidden="true"
              title="Copal incense"
              className="flex flex-col items-center opacity-70 mb-0.5 select-none"
            >
              <svg width="28" height="36" viewBox="0 0 28 36" className="overflow-visible">
                <path
                  d="M14,16 C11,10 17,6 13,0"
                  fill="none"
                  stroke="rgba(226, 232, 240, 0.3)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  className={reducedMotion ? '' : 'smoke-wisp'}
                />
                <path
                  d="M5,18 L23,18 L20,25 L16,27 L17,34 L11,34 L12,27 L8,25 Z"
                  fill="#292524"
                  stroke="#a16207"
                  strokeOpacity="0.55"
                  strokeWidth="1"
                />
              </svg>
            </div>
          )}

          <MarigoldCluster className="hidden md:block opacity-85 mb-0.5 scale-x-[-1]" />
        </div>

        {/* Tier 3 Base Plinth */}
        <div className="w-full h-9 rounded-t-md rounded-b-sm bg-gradient-to-b from-[#231836] via-[#161024] to-[#0d0a18] border border-[#ff9f1c]/25 shadow-[0_18px_40px_rgba(0,0,0,0.9)] relative overflow-hidden flex items-center justify-between px-6">
          {/* Scattered cempasúchil petals along base */}
          <div
            aria-hidden="true"
            className="w-full flex items-center justify-around opacity-55"
          >
            <span className="w-2.5 h-1 rounded-full bg-[#ff9f1c] rotate-12" />
            <span className="w-2 h-1 rounded-full bg-[#ffbf69] -rotate-6" />
            <span className="w-3 h-1 rounded-full bg-[#c85a8e] rotate-3" />
            <span className="w-2.5 h-1 rounded-full bg-[#ff9f1c] -rotate-12" />
            <span className="w-2 h-1 rounded-full bg-[#fde047] rotate-6" />
            <span className="w-2.5 h-1 rounded-full bg-[#ff9f1c] rotate-12" />
          </div>
        </div>
      </div>
    </section>
  );
};
