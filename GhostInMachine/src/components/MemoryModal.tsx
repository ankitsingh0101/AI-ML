import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ImagePlus, X } from 'lucide-react';

interface MemoryModalProps {
  isOpen: boolean;
  honoreeName: string;
  reducedMotion: boolean;
  onClose: () => void;
  onSubmitStory: (story: string, photoBase64?: string) => Promise<void>;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  honoreeName,
  reducedMotion,
  onClose,
  onSubmitStory,
}) => {
  const [story, setStory] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  const [isLighting, setIsLighting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLighting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLighting, onClose]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!story.trim() || story.trim().length < 8) {
      setErrorMsg('Please share at least a sentence so the candle has a memory to hold.');
      return;
    }

    setErrorMsg(null);
    setIsLighting(true);
    try {
      await onSubmitStory(story.trim(), photoBase64);
      setStory('');
      setPhotoBase64(undefined);
      onClose();
    } catch {
      setErrorMsg('Could not light the candle right now. Please try again.');
    } finally {
      setIsLighting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-memory-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            onClick={() => !isLighting && onClose()}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="relative z-10 w-full max-w-lg rounded-xl bg-[#121026] border border-[#ff9f1c]/30 shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-6 sm:p-7 text-[#f5f0e6]"
          >
            {isLighting ? (
              /* "Lighting a candle..." ritual animation state */
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="relative flex flex-col items-center mb-5">
                  <motion.div
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{
                      scale: reducedMotion ? 1 : [0.4, 1.25, 1],
                      opacity: [0.3, 1, 0.85],
                    }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatType: 'reverse' }}
                    className="w-16 h-16 rounded-full bg-[#ff9f1c]/35 blur-xl absolute -top-4"
                  />
                  <svg width="32" height="44" viewBox="0 0 26 36" className="relative z-10">
                    <path
                      d="M13,2 C13,2 22,14 22,23 C22,29.5 18,34 13,34 C8,34 4,29.5 4,23 C4,14 13,2 13,2 Z"
                      fill="#ff9f1c"
                    />
                    <path
                      d="M13,9 C13,9 18.5,17 18.5,24 C18.5,28.5 16,32 13,32 C10,32 7.5,28.5 7.5,24 C7.5,17 13,9 13,9 Z"
                      fill="#fde047"
                    />
                  </svg>
                  <div className="w-7 h-10 rounded-t bg-gradient-to-b from-[#fff7e6] to-[#b8864b] border border-[#f5f0e6]/20" />
                </div>
                <p className="font-serif italic text-2xl text-[#ffbf69]">
                  Lighting a candle...
                </p>
                <p className="mt-1.5 text-xs text-[#f5f0e6]/65">
                  Gathering title, essence, and memory threads locally
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2
                      id="add-memory-modal-title"
                      className="font-serif text-2xl sm:text-3xl font-medium text-[#f5f0e6]"
                    >
                      Light a Memory Candle
                    </h2>
                    <p className="text-xs sm:text-sm text-[#f5f0e6]/65 mt-0.5">
                      For {honoreeName} · Each story places a living flame upon the altar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close modal"
                    className="p-1.5 rounded-lg text-[#f5f0e6]/55 hover:text-[#f5f0e6] hover:bg-[#f5f0e6]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="memory-story-input"
                      className="block text-xs font-medium text-[#f5f0e6]/80 mb-1.5"
                    >
                      Your story
                    </label>
                    <textarea
                      id="memory-story-input"
                      ref={textareaRef}
                      rows={5}
                      value={story}
                      onChange={(e) => setStory(e.target.value)}
                      placeholder="Tell a story about them... a small habit, a recipe, the sound of their voice on rainy afternoons."
                      className="w-full rounded-lg bg-[#0b0a1a]/90 border border-[#f5f0e6]/15 px-3.5 py-3 text-sm text-[#f5f0e6] placeholder:text-[#f5f0e6]/35 leading-relaxed focus:outline-none focus:border-[#ff9f1c] focus:ring-1 focus:ring-[#ff9f1c]"
                    />
                  </div>

                  {/* Optional Keepsake Photo Upload */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    {photoBase64 ? (
                      <div className="relative flex items-center gap-3 p-2.5 rounded-lg bg-[#0b0a1a]/70 border border-[#f5f0e6]/15">
                        <img
                          src={photoBase64}
                          alt="Uploaded memory keepsake preview"
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded object-cover border border-[#ff9f1c]/30"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#f5f0e6]/90 font-medium">
                            Keepsake photograph attached
                          </p>
                          <p className="text-[11px] text-[#f5f0e6]/55">
                            Stored privately in your browser alongside this candle
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPhotoBase64(undefined)}
                          aria-label="Remove attached photo"
                          className="p-1.5 rounded text-[#f5f0e6]/50 hover:text-rose-300 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-dashed border-[#f5f0e6]/25 text-xs text-[#f5f0e6]/75 hover:border-[#ff9f1c]/60 hover:text-[#ffbf69] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c] cursor-pointer"
                      >
                        <ImagePlus className="w-4 h-4 text-[#ff9f1c]" />
                        Attach an optional photograph
                      </button>
                    )}
                  </div>

                  {errorMsg && (
                    <p role="alert" className="text-xs text-amber-300">
                      {errorMsg}
                    </p>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#f5f0e6]/10">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-[#f5f0e6]/70 hover:text-[#f5f0e6] hover:bg-[#f5f0e6]/5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#ff9f1c] text-[#0b0a1a] text-xs font-semibold hover:bg-[#ffbf69] transition-colors shadow-[0_0_20px_rgba(255,159,28,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf69] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Flame className="w-4 h-4" />
                      Light Candle
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
