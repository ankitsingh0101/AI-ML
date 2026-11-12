import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, Package, Image as ImageIcon } from 'lucide-react';

interface CreditsModalProps {
  isOpen: boolean;
  reducedMotion: boolean;
  onClose: () => void;
}

const OPEN_SOURCE_LIBRARIES = [
  {
    name: 'Gemma (Google) via Ollama',
    license: 'Gemma Terms of Use / MIT (Ollama)',
    purpose: 'Local open-weight language and vision model that answers questions, names memories and plays the haunted entity. Runs entirely on your own machine.',
  },
  {
    name: 'React & React DOM (v19)',
    license: 'MIT License',
    purpose: 'Declarative UI component tree and state orchestration.',
  },
  {
    name: 'Vite & TypeScript',
    license: 'MIT / Apache-2.0',
    purpose: 'Offline-ready local module bundler and static type verification.',
  },
  {
    name: 'Tailwind CSS (v4)',
    license: 'MIT License',
    purpose: 'Utility-first styling, dark sanctuary palette, and responsive layout.',
  },
  {
    name: 'Motion / Framer Motion (v12)',
    license: 'MIT License',
    purpose: 'Translucent ambient ghost wisps, sparkle dissolve physics, and reduced-motion hooks.',
  },
  {
    name: 'tsParticles (@tsparticles/react, @tsparticles/slim, @tsparticles/engine)',
    license: 'MIT License',
    purpose: 'Canvas particle layer rendering upward white-blue spirit wisps and marigold candle embers.',
  },
  {
    name: 'lottie-react & Lottie-Web',
    license: 'MIT License',
    purpose: 'Vector keyframe playback for GhostLottie (new candle spirit) and SmokeLottie (extinguished wick).',
  },
  {
    name: 'Lucide React',
    license: 'ISC License',
    purpose: 'Clean, accessible vector iconography across controls and dialogs.',
  },
  {
    name: '@fontsource/cormorant-garamond & @fontsource/inter',
    license: 'OFL-1.1 (SIL Open Font License)',
    purpose: 'Self-hosted editorial serif and clean body typography bundled locally with zero CDN calls.',
  },
];

const BUNDLED_ASSETS = [
  {
    name: 'Ghost Rising Lottie (/src/assets/lottie/ghost-rising.json)',
    source: 'Bundled custom Lottie JSON placeholder (replaceable via LottieFiles Free License)',
    notes: 'Plays when a new memory candle is lit. Swap in free ghost/spirit JSONs from lottiefiles.com/free-animations/ghost.',
  },
  {
    name: 'Candle Smoke Lottie (/src/assets/lottie/candle-smoke.json)',
    source: 'Bundled custom Lottie JSON placeholder (replaceable via LottieFiles Free License)',
    notes: 'Plays on extinguished candles (strength = 0). Swap in free smoke JSONs from lottiefiles.com/free-animations/smoke.',
  },
  {
    name: 'Default Ofrenda Portrait (Abuela Elena Morales)',
    source: 'AI-generated sample image of a fictional person, bundled in /src/assets/images/. Replace it with your own photo.',
    notes: 'Stored inside the build bundle; user-uploaded portraits remain strictly in browser localStorage.',
  },
  {
    name: 'Papel Picado, Cempasúchil Clusters, Candle Flames & Film Grain',
    source: 'Original hand-crafted inline SVG & CSS keyframe artwork',
    notes: 'Zero external requests; works completely offline.',
  },
];

export const CreditsModal: React.FC<CreditsModalProps> = ({
  isOpen,
  reducedMotion,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="credits-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-[#121026] border border-[#ff9f1c]/30 shadow-[0_24px_64px_rgba(0,0,0,0.88)] p-6 sm:p-7 text-[#f5f0e6]"
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#f5f0e6]/10">
              <div>
                <h2
                  id="credits-modal-title"
                  className="font-serif text-2xl sm:text-3xl font-medium text-[#f5f0e6]"
                >
                  Credits &amp; Offline Open-Source Stack
                </h2>
                <p className="text-xs sm:text-sm text-[#f5f0e6]/65 mt-0.5">
                  Every library, font, and animation asset is bundled locally via npm for 100% offline operation.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close credits modal"
                className="p-1.5 rounded-lg text-[#f5f0e6]/55 hover:text-[#f5f0e6] hover:bg-[#f5f0e6]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Open Source Libraries */}
            <div className="mt-5">
              <h3 className="font-serif text-lg text-[#ffbf69] flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-[#ff9f1c]" aria-hidden="true" />
                Open-Source Libraries
              </h3>
              <dl className="divide-y divide-[#f5f0e6]/10 border-y border-[#f5f0e6]/10">
                {OPEN_SOURCE_LIBRARIES.map((lib) => (
                  <div key={lib.name} className="py-2.5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4">
                    <div className="min-w-0">
                      <dt className="text-xs sm:text-sm font-medium text-[#f5f0e6]">
                        {lib.name}
                        <span className="ml-2 text-[11px] font-normal text-[#ffbf69]/80">
                          · {lib.license}
                        </span>
                      </dt>
                      <dd className="text-xs text-[#f5f0e6]/60 mt-0.5">{lib.purpose}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            {/* Section 2: Visual, Typography & Lottie Assets */}
            <div className="mt-6">
              <h3 className="font-serif text-lg text-[#ffbf69] flex items-center gap-2 mb-3">
                <ImageIcon className="w-4 h-4 text-[#ff9f1c]" aria-hidden="true" />
                Bundled Artwork &amp; Lottie Animations
              </h3>
              <dl className="divide-y divide-[#f5f0e6]/10 border-y border-[#f5f0e6]/10">
                {BUNDLED_ASSETS.map((asset) => (
                  <div key={asset.name} className="py-2.5">
                    <dt className="text-xs sm:text-sm font-medium text-[#f5f0e6]">
                      {asset.name}
                    </dt>
                    <dd className="text-[11px] text-[#ffbf69]/85 mt-0.5">{asset.source}</dd>
                    <dd className="text-xs text-[#f5f0e6]/60 mt-0.5">{asset.notes}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* LottieFiles Attribution Guide */}
            <div className="mt-5 p-3.5 rounded-lg bg-[#0b0a1a]/80 border border-[#f5f0e6]/10 flex items-start gap-3">
              <BookOpen className="w-4 h-4 text-[#ff9f1c] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-[#f5f0e6]/70 leading-relaxed">
                To customize the rising spirit or candle smoke animations with community artwork, download free Lottie JSON files from{' '}
                <span className="text-[#ffbf69]">lottiefiles.com/free-animations/ghost</span> or{' '}
                <span className="text-[#ffbf69]">lottiefiles.com/free-animations/smoke</span> and drop them into{' '}
                <code className="text-[#f5f0e6]/90">/src/assets/lottie/</code>.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#ff9f1c] text-[#0b0a1a] text-xs font-semibold hover:bg-[#ffbf69] transition-colors cursor-pointer"
              >
                Close Credits
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
