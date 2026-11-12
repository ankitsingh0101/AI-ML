import React, { useRef, useEffect } from 'react';
import { Lottie, type LottieHandle } from 'lottie-react';
import candleSmokeData from '../assets/lottie/candle-smoke.json';

/**
 * SmokeLottie — Plays a delicate curling smoke wisp when a memory candle's strength reaches 0.
 *
 * Currently bundled with a lightweight offline Lottie JSON placeholder at:
 *   /src/assets/lottie/candle-smoke.json
 *
 * WHERE TO DOWNLOAD FREE REPLACEMENT LOTTIE ANIMATIONS (LottieFiles Free License):
 * 1. Browse gentle smoke wisps: https://lottiefiles.com/free-animations/smoke
 * 2. Browse candle smoke plumes: https://lottiefiles.com/free-animations/candle-smoke
 * Download the Lottie JSON (`.json`) file, replace `/src/assets/lottie/candle-smoke.json`,
 * and credit the artist in `CreditsModal.tsx`.
 */

interface SmokeLottieProps {
  reducedMotion: boolean;
  className?: string;
}

export const SmokeLottie: React.FC<SmokeLottieProps> = ({
  reducedMotion,
  className = '',
}) => {
  const lottieRef = useRef<LottieHandle>(null);

  useEffect(() => {
    if (reducedMotion) {
      lottieRef.current?.pause();
      lottieRef.current?.seek(50);
    } else {
      lottieRef.current?.play();
    }
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none blur-[0.8px] ${className}`}
    >
      <Lottie
        lottieRef={lottieRef}
        src={candleSmokeData}
        autoplay={!reducedMotion}
        loop={!reducedMotion}
        style={{ width: 34, height: 52 }}
      />
    </div>
  );
};
