import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Trash2, X, Plus } from 'lucide-react';
import { Memory } from '../types';
import { getStrengthLabel } from '../utils/memoryMath';

interface MemoryDrawerProps {
  memory: Memory | null;
  strength: number;
  daysSinceRecall: number;
  reducedMotion: boolean;
  onClose: () => void;
  onRememberAgain: (memoryId: string) => void;
  onAppendNote: (memoryId: string, additionalNote: string) => void;
  onDeleteMemory: (memoryId: string) => void;
}

export const MemoryDrawer: React.FC<MemoryDrawerProps> = ({
  memory,
  strength,
  daysSinceRecall,
  reducedMotion,
  onClose,
  onRememberAgain,
  onAppendNote,
  onDeleteMemory,
}) => {
  const [justRestored, setJustRestored] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    setJustRestored(false);
    setIsAddingNote(false);
    setNoteDraft('');
    setConfirmingDelete(false);
  }, [memory?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && memory) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [memory, onClose]);

  const handleRememberClick = () => {
    if (!memory) return;
    onRememberAgain(memory.id);
    setJustRestored(true);
    setTimeout(() => setJustRestored(false), 1400);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memory || !noteDraft.trim()) return;
    onAppendNote(memory.id, noteDraft.trim());
    setNoteDraft('');
    setIsAddingNote(false);
    setJustRestored(true);
    setTimeout(() => setJustRestored(false), 1400);
  };

  const strengthPercent = Math.round(strength * 100);
  const stateLabel = getStrengthLabel(strength);

  return (
    <AnimatePresence>
      {memory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-drawer-title"
          className="fixed inset-0 z-50 flex justify-end"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/65 backdrop-blur-[2px]"
          />

          {/* Slide-over Sanctuary Drawer */}
          <motion.aside
            initial={reducedMotion ? { opacity: 0 } : { x: '100%' }}
            animate={reducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md h-full overflow-y-auto bg-[#110f24] border-l border-[#ff9f1c]/25 shadow-[-16px_0_48px_rgba(0,0,0,0.85)] p-6 sm:p-7 flex flex-col justify-between text-[#f5f0e6]"
          >
            {/* Glow burst overlay when "Remember this again" is triggered */}
            <AnimatePresence>
              {justRestored && (
                <motion.div
                  initial={{ opacity: 0.75 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1 }}
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#ff9f1c]/25 via-amber-400/10 to-transparent z-20"
                />
              )}
            </AnimatePresence>

            <div>
              {/* Top Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#f5f0e6]/10">
                <div>
                  {/* Zero-pill clean metadata with typographic separators */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#f5f0e6]/55 mb-1.5 tabular-nums">
                    <span>
                      {daysSinceRecall === 0
                        ? 'Recalled today'
                        : `${daysSinceRecall} ${daysSinceRecall === 1 ? 'day' : 'days'} since recall`}
                    </span>
                    {memory.tags.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#ffbf69]/85">
                          {memory.tags.join(' · ')}
                        </span>
                      </>
                    )}
                  </div>
                  <h2
                    id="memory-drawer-title"
                    className="font-serif text-2xl sm:text-3xl font-medium text-[#f5f0e6] leading-snug [text-wrap:balance]"
                  >
                    {memory.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close memory details"
                  className="p-1.5 rounded-lg text-[#f5f0e6]/55 hover:text-[#f5f0e6] hover:bg-[#f5f0e6]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Strength Meter */}
              <div className="my-5 p-4 rounded-lg bg-[#0b0a1a]/80 border border-[#f5f0e6]/10">
                <div className="flex items-center justify-between text-xs mb-2 tabular-nums">
                  <span className="text-[#f5f0e6]/75 font-medium">
                    Candle Strength
                  </span>
                  <span
                    className={`font-medium ${
                      strength <= 0
                        ? 'text-slate-400'
                        : strength < 0.3
                        ? 'text-amber-300'
                        : 'text-[#ffbf69]'
                    }`}
                  >
                    {strengthPercent}% · {stateLabel}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={strengthPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Memory flame strength"
                  className="w-full h-2 rounded-full bg-[#1d1936] overflow-hidden"
                >
                  <div
                    style={{ width: `${strengthPercent}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      strength <= 0
                        ? 'bg-slate-600'
                        : strength < 0.3
                        ? 'bg-amber-500/80'
                        : 'bg-gradient-to-r from-[#ff9f1c] to-[#fde047] shadow-[0_0_12px_#ff9f1c]'
                    }`}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[#f5f0e6]/55 leading-relaxed">
                  {strength <= 0
                    ? 'This flame has gone out with time. Remembering it again will relight the wick.'
                    : strength < 0.3
                    ? 'This memory is fading into dusk. Revisit it to restore its full warmth.'
                    : 'Burning steadily on the ofrenda. Memories halve in brightness every ten days left unvisited.'}
                </p>
              </div>

              {/* Primary Restore Action ("Remember this again") */}
              <button
                type="button"
                onClick={handleRememberClick}
                className="w-full mb-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#ff9f1c] text-[#0b0a1a] text-sm font-semibold hover:bg-[#ffbf69] transition-colors shadow-[0_0_24px_rgba(255,159,28,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf69] whitespace-nowrap cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                {justRestored ? 'Flame Restored to Full Radiance' : 'Remember this again'}
              </button>

              {/* Optional Attached Photo */}
              {memory.photoBase64 && (
                <figure className="mb-6">
                  <div className="rounded-lg overflow-hidden border border-[#ff9f1c]/25 bg-[#0b0a1a]">
                    <img
                      src={memory.photoBase64}
                      alt={memory.photoDescription || memory.title}
                      referrerPolicy="no-referrer"
                      className="w-full max-h-60 object-cover"
                    />
                  </div>
                  {memory.photoDescription && (
                    <figcaption className="mt-2 font-serif italic text-xs text-[#f5f0e6]/60">
                      {memory.photoDescription}
                    </figcaption>
                  )}
                </figure>
              )}

              {/* Editorial Story Prose */}
              <div className="space-y-4">
                <p
                  style={{ opacity: Math.max(0.45, 0.5 + strength * 0.5) }}
                  className="text-[15px] leading-relaxed text-[#f5f0e6]/90 whitespace-pre-line first-letter:font-serif first-letter:text-4xl first-letter:float-left first-letter:mr-2.5 first-letter:leading-none first-letter:text-[#ffbf69]"
                >
                  {memory.story}
                </p>

                {/* Add to this memory (also restores strength to 1) */}
                {isAddingNote ? (
                  <form onSubmit={handleSaveNote} className="pt-3 space-y-2.5">
                    <label
                      htmlFor="append-memory-note"
                      className="block text-xs text-[#f5f0e6]/75"
                    >
                      Add another detail you just recalled
                    </label>
                    <textarea
                      id="append-memory-note"
                      rows={3}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Write another detail to weave into this memory..."
                      className="w-full rounded-lg bg-[#0b0a1a] border border-[#f5f0e6]/20 px-3 py-2 text-sm text-[#f5f0e6] focus:outline-none focus:border-[#ff9f1c]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingNote(false)}
                        className="px-3 py-1.5 text-xs text-[#f5f0e6]/65 hover:text-[#f5f0e6] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 rounded bg-[#ff9f1c]/20 border border-[#ff9f1c]/50 text-xs font-medium text-[#ffbf69] hover:bg-[#ff9f1c]/30 cursor-pointer"
                      >
                        Save &amp; Restore Flame
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingNote(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#ffbf69]/85 hover:text-[#ffbf69] underline underline-offset-4 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add another detail to this memory
                  </button>
                )}
              </div>
            </div>

            {/* Quiet Delete Option at Foot of Drawer */}
            <div className="pt-6 mt-8 border-t border-[#f5f0e6]/10 flex items-center justify-between text-xs text-[#f5f0e6]/45">
              <span>
                Lit {new Date(memory.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {confirmingDelete ? (
                <span className="inline-flex items-center gap-3" role="alert">
                  <span className="text-rose-200/90">Remove this candle for good?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteMemory(memory.id);
                      onClose();
                    }}
                    className="text-rose-300 hover:text-rose-200 font-medium underline underline-offset-4 cursor-pointer"
                  >
                    Yes, remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="text-[#f5f0e6]/70 hover:text-[#f5f0e6] underline underline-offset-4 cursor-pointer"
                  >
                    Keep it
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="inline-flex items-center gap-1.5 text-rose-300/65 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove candle
                </button>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
