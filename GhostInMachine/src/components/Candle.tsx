import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Memory } from '../types';
import { GhostLottie } from './GhostLottie';
import { SmokeLottie } from './SmokeLottie';

interface CandleProps {
  memory: Memory;
  strength: number; // 0 to 1
  isSelected: boolean;
  isNewlyAdded: boolean;
  isRekindled: boolean;
  reducedMotion: boolean;
  onSelect: (memory: Memory) => void;
}

export const Candle: React.FC<CandleProps> = ({
  memory,
  strength,
  isSelected,
  isNewlyAdded,
  isRekindled,
  reducedMotion,
  onSelect,
}) => {
  // Deterministic organic timing per candle based on memory.id
  const { flameDur, flameDelay, haloDur, candleHeight } = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < memory.id.length; i++) {
      hash = (hash * 31 + memory.id.charCodeAt(i)) % 997;
    }
    return {
      flameDur: `${(2.1 + (hash % 14) * 0.11).toFixed(2)}s`,
      flameDelay: `-${((hash % 20) * 0.15).toFixed(2)}s`,
      haloDur: `${(3.2 + (hash % 12) * 0.18).toFixed(2)}s`,
      candleHeight: 48 + (hash % 18), // slight natural variation in wax height (48px - 65px)
    };
  }, [memory.id]);

  const isOut = strength <= 0;
  const isFading = strength > 0 && strength < 0.3;

  // Scale flame dimensions smoothly by strength
  const flameScale = isOut ? 0 : 0.48 + strength * 0.65;
  const haloRadius = isOut ? 0 : 28 + strength * 46;
  const haloOpacity = isOut ? 0 : 0.16 + strength * 0.52;

  const statusText = isOut
    ? 'extinguished'
    : isFading
    ? 'fading...'
    : `${Math.round(strength * 100)}% vivid`;

  return (
    <div className="relative flex flex-col items-center group">
      {/* 2. GhostLottie + Framer Motion sparkle dissolve when a new memory is added */}
      <AnimatePresence>
        {isNewlyAdded && (
          <motion.div
            key="new-memory-ghost"
            initial={reducedMotion ? { opacity: 0.7, y: -32 } : { opacity: 0, y: 8, scale: 0.8 }}
            animate={
              reducedMotion
                ? { opacity: [0.7, 0], y: -32 }
                : {
                    opacity: [0, 0.88, 0.65, 0],
                    y: [8, -38, -82, -118],
                    scale: [0.8, 1, 1.08, 1.15],
                  }
            }
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 1.2 : 3.4, ease: 'easeOut' }}
            className="pointer-events-none absolute -top-28 z-30 flex flex-col items-center"
          >
            {/* Local Lottie rising ghost animation (autoplay disabled when reducedMotion is true) */}
            <GhostLottie reducedMotion={reducedMotion} />

            {/* Framer Motion dissolving golden-blue sparkles */}
            {!reducedMotion &&
              [
                { dx: -16, dy: -18, delay: 1.0 },
                { dx: 14, dy: -30, delay: 1.25 },
                { dx: -6, dy: -44, delay: 1.45 },
                { dx: 18, dy: -14, delay: 1.15 },
                { dx: 2, dy: -54, delay: 1.65 },
              ].map((sp, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 0.95, 0],
                    scale: [0.3, 1.25, 0.2],
                    x: sp.dx,
                    y: sp.dy,
                  }}
                  transition={{ duration: 1.8, delay: sp.delay, ease: 'easeOut' }}
                  className="absolute top-6 w-1.5 h-1.5 rounded-full bg-amber-200 shadow-[0_0_8px_#ff9f1c]"
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rekindled golden glow burst when "Remember this again" is clicked */}
      <AnimatePresence>
        {isRekindled && (
          <motion.div
            key="rekindle-burst"
            initial={{ opacity: 0.9, scale: 0.4 }}
            animate={{ opacity: 0, scale: 2.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.3 : 1.1, ease: 'easeOut' }}
            className="pointer-events-none absolute -top-6 w-16 h-16 rounded-full bg-amber-300/50 blur-xl z-20"
          />
        )}
      </AnimatePresence>

      {/* 3. Fading memory (< 0.3): small Framer Motion ghost wisp slowly lifting away */}
      {isFading && !reducedMotion && (
        <motion.div
          animate={{
            y: [0, -34, -64],
            x: [0, -7, 6],
            opacity: [0, 0.48, 0],
            scale: [0.75, 1.05, 1.25],
          }}
          transition={{
            duration: 4.8,
            repeat: Infinity,
            ease: 'easeOut',
          }}
          className="pointer-events-none absolute -top-12 z-20"
        >
          <svg width="26" height="40" viewBox="0 0 26 40" className="blur-[1.5px]">
            <path
              d="M13,38 C7,30 4,21 9,13 C13,6 19,5 17,1 C22,8 23,19 18,28 C15,33 14,36 13,38 Z"
              fill="rgba(186, 230, 253, 0.65)"
            />
          </svg>
        </motion.div>
      )}

      {/* Hover / Focus / Fading label */}
      <div
        className={`pointer-events-none absolute -top-11 z-30 whitespace-nowrap px-2.5 py-1 rounded bg-[#0b0a1a]/95 border border-[#f5f0e6]/15 shadow-lg transition-all duration-200 ${
          'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0'
        }`}
      >
        <p className="text-xs font-serif tracking-wide text-[#f5f0e6] max-w-[165px] truncate">
          {memory.title}
        </p>
        {isFading && (
          <p className="text-[10px] italic text-amber-300/90 text-center leading-tight">
            fading...
          </p>
        )}
        {isOut && (
          <p className="text-[10px] italic text-slate-400 text-center leading-tight">
            candle out
          </p>
        )}
      </div>

      {/* Interactive Candle Button */}
      <button
        type="button"
        onClick={() => onSelect(memory)}
        aria-label={`${memory.title} — memory candle (${statusText}). Activate to view memory details.`}
        style={
          {
            '--flame-dur': flameDur,
            '--flame-delay': flameDelay,
            '--halo-dur': haloDur,
          } as React.CSSProperties
        }
        className={`relative flex flex-col items-center justify-end pt-8 pb-1 px-2.5 min-w-[44px] min-h-[84px] rounded-lg transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a1a] hover:-translate-y-0.5 cursor-pointer ${
          isSelected ? 'ring-1 ring-[#ff9f1c]/70 bg-[#ff9f1c]/[0.06]' : ''
        }`}
      >
        {/* Warm radial candlelight glow */}
        {!isOut && (
          <div
            aria-hidden="true"
            style={{
              width: `${haloRadius}px`,
              height: `${haloRadius}px`,
              opacity: haloOpacity,
              background:
                'radial-gradient(circle, rgba(255,196,88,0.85) 0%, rgba(255,159,28,0.38) 45%, rgba(255,159,28,0) 75%)',
            }}
            className="pointer-events-none absolute top-1 rounded-full blur-md halo-breath"
          />
        )}

        {/* Flame OR SmokeLottie when strength == 0 */}
        <div className="relative h-9 w-7 flex items-end justify-center -mb-1 z-10">
          {isOut ? (
            /* Local Lottie smoke animation for extinguished candles */
            <SmokeLottie reducedMotion={reducedMotion} className="-mb-1" />
          ) : (
            /* Layered organic SVG candle flame */
            <svg
              width="26"
              height="36"
              viewBox="0 0 26 36"
              style={{ transform: `scale(${flameScale})` }}
              className="overflow-visible origin-bottom transition-transform duration-300"
              aria-hidden="true"
            >
              {/* Outer amber teardrop */}
              <g className={isFading ? 'flame-weak' : 'flame-organic-a'}>
                <path
                  d="M13,2 C13,2 22,14 22,23 C22,29.5 18,34 13,34 C8,34 4,29.5 4,23 C4,14 13,2 13,2 Z"
                  fill="rgba(255, 159, 28, 0.88)"
                />
              </g>
              {/* Inner luminous gold & bone-white core */}
              <g className={isFading ? 'flame-weak' : 'flame-organic-b'}>
                <path
                  d="M13,8 C13,8 19,17 19,24 C19,28.5 16.3,32 13,32 C9.7,32 7,28.5 7,24 C7,17 13,8 13,8 Z"
                  fill="#fde047"
                />
                <ellipse cx="13" cy="27" rx="3.2" ry="4.5" fill="#fffbeb" />
                <ellipse cx="13" cy="31" rx="1.8" ry="1.8" fill="#60a5fa" fillOpacity="0.65" />
              </g>
            </svg>
          )}
        </div>

        {/* Charred cotton wick */}
        <div
          aria-hidden="true"
          className={`w-[2px] h-2 rounded-t-full ${
            isOut ? 'bg-stone-600' : 'bg-amber-950'
          }`}
        />

        {/* Beeswax / Ivory Altar Pillar */}
        <div
          aria-hidden="true"
          style={{
            height: `${candleHeight}px`,
            opacity: isOut ? 0.52 : 0.72 + strength * 0.28,
          }}
          className="relative w-6 sm:w-7 rounded-t-[5px] rounded-b-[3px] overflow-hidden shadow-[0_6px_14px_rgba(0,0,0,0.65)] border border-[#f5f0e6]/15 transition-opacity duration-300"
        >
          {/* Wax body illuminated from top */}
          <div
            className="absolute inset-0"
            style={{
              background: isOut
                ? 'linear-gradient(180deg, #6b6661 0%, #3d3936 55%, #262322 100%)'
                : `linear-gradient(180deg, rgba(255, 238, 196, ${
                    0.75 + strength * 0.25
                  }) 0%, rgba(235, 198, 138, 0.88) 38%, rgba(164, 114, 58, 0.92) 100%)`,
            }}
          />
          {/* Melted wax drip detail */}
          <svg
            viewBox="0 0 28 18"
            className="relative w-full h-4 opacity-80"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0 L28,0 L28,5 C24,5 23,13 20,13 C17,13 17,6 13,6 C10,6 9,15 6,15 C3,15 3,6 0,5 Z"
              fill={isOut ? '#857f79' : '#fff7e6'}
              fillOpacity={isOut ? 0.45 : 0.75}
            />
          </svg>
        </div>

        {/* Terracotta / Brass Candle Saucer */}
        <div
          aria-hidden="true"
          className="w-9 sm:w-10 h-1.5 rounded-full bg-gradient-to-r from-amber-900/80 via-amber-700/90 to-amber-900/80 shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
        />
      </button>

      {/* Persistent quiet caption underneath if fading */}
      {isFading && (
        <span className="mt-0.5 text-[10px] italic text-amber-300/80 tracking-wide select-none">
          fading...
        </span>
      )}
    </div>
  );
};
