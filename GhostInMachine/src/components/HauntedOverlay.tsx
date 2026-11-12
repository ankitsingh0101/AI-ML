import React, { useEffect, useState } from 'react';

interface HauntedOverlayProps {
  enabled: boolean;
  reducedMotion: boolean;
}

export const HauntedOverlay: React.FC<HauntedOverlayProps> = ({
  enabled,
  reducedMotion,
}) => {
  const [cursorPos, setCursorPos] = useState({ x: -200, y: -200 });
  const [hasMoved, setHasMoved] = useState(false);

  useEffect(() => {
    if (!enabled || reducedMotion) {
      setHasMoved(false);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
      setHasMoved(true);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [enabled, reducedMotion]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {/* Cold blue-green atmospheric tint + deeper vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(20, 184, 166, 0.06) 0%, rgba(8, 47, 73, 0.24) 55%, rgba(2, 4, 10, 0.78) 100%)',
        }}
      />

      {/* Faint ghost wisp softly trailing the cursor */}
      {!reducedMotion && hasMoved && (
        <div
          style={{
            transform: `translate3d(${cursorPos.x - 44}px, ${cursorPos.y - 44}px, 0)`,
            transition: 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="absolute top-0 left-0 w-22 h-22"
        >
          <div className="w-full h-full rounded-full blur-xl bg-gradient-to-br from-teal-200/25 via-cyan-300/15 to-transparent" />
          <svg
            width="44"
            height="58"
            viewBox="0 0 44 58"
            className="absolute top-3 left-5 blur-[1.5px] opacity-40"
          >
            <path
              d="M22,4 C14,4 10,11 10,19 C10,28 5,36 8,47 C11,54 17,55 22,56 C27,55 33,54 36,47 C39,36 34,28 34,19 C34,11 30,4 22,4 Z"
              fill="rgba(165, 243, 252, 0.55)"
            />
          </svg>
        </div>
      )}
    </div>
  );
};
