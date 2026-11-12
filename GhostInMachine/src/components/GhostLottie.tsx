import React, { useRef, useEffect } from 'react';
import { Lottie, type LottieHandle } from 'lottie-react';
import ghostRisingData from '../assets/lottie/ghost-rising.json';

/**
 * GhostLottie — Plays a rising spirit animation when a new memory candle is lit.
 *
 * Currently bundled with a lightweight offline Lottie JSON placeholder at:
 *   /src/assets/lottie/ghost-rising.json
 *
 * WHERE TO DOWNLOAD FREE REPLACEMENT LOTTIE ANIMATIONS (LottieFiles Free License):
 * 1. Browse ghostly/spirit wisp animations: https://lottiefiles.com/free-animations/ghost
 * 2. Browse ethereal light/sparkle wisps:   https://lottiefiles.com/free-animations/spirit
 * Download the ".json" (Lottie JSON, not .lottie) file, save it to
 * `/src/assets/lottie/ghost-rising.json`, and record the creator attribution in `CreditsModal.tsx`.
 */

interface GhostLottieProps {
  reducedMotion: boolean;
  className?: string;
}

export const GhostLottie: React.FC<GhostLottieProps> = ({
  reducedMotion,
  className = '',
}) => {
  const lottieRef = useRef<LottieHandle>(null);

  useEffect(() => {
    if (reducedMotion) {
      lottieRef.current?.pause();
      lottieRef.current?.seek(35);
    } else {
      lottieRef.current?.play();
    }
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none blur-[1px] ${className}`}
    >
      <Lottie
        lottieRef={lottieRef}
        src={ghostRisingData}
        autoplay={!reducedMotion}
        loop={false}
        style={{ width: 76, height: 114 }}
      />
    </div>
  );
};
