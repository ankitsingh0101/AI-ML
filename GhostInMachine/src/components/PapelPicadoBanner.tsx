import React from 'react';

interface PapelPicadoBannerProps {
  reducedMotion: boolean;
}

const BANNER_COLORS = [
  { fill: '#ff9f1c', stroke: '#ffbf69', label: 'Marigold' },
  { fill: '#c85a8e', stroke: '#e08bb1', label: 'Soft Magenta' },
  { fill: '#d97706', stroke: '#fbbf24', label: 'Candle Gold' },
  { fill: '#7c4d8b', stroke: '#a97bb8', label: 'Dusk Violet' },
  { fill: '#ff9f1c', stroke: '#ffbf69', label: 'Marigold' },
  { fill: '#b84a7a', stroke: '#d87ca4', label: 'Rose Dusk' },
  { fill: '#eab308', stroke: '#fde047', label: 'Warm Gold' },
];

export const PapelPicadoBanner: React.FC<PapelPicadoBannerProps> = ({ reducedMotion }) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none w-full overflow-hidden relative z-10 opacity-85"
    >
      <div className={reducedMotion ? '' : 'papel-sway'}>
        <svg
          viewBox="0 0 1200 86"
          preserveAspectRatio="none"
          className="w-full h-12 sm:h-16 md:h-20 drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)]"
        >
          {/* Hanging cord */}
          <path
            d="M 0,4 Q 600,18 1200,4"
            fill="none"
            stroke="rgba(245, 240, 230, 0.28)"
            strokeWidth="1.5"
          />

          {BANNER_COLORS.map((color, idx) => {
            const x = 28 + idx * 166;
            const yOffset = Math.sin((idx / (BANNER_COLORS.length - 1)) * Math.PI) * 8;
            return (
              <g
                key={idx}
                transform={`translate(${x}, ${6 + yOffset})`}
                style={
                  reducedMotion
                    ? undefined
                    : {
                        transformOrigin: '68px 0px',
                      }
                }
              >
                {/* Tissue flag silhouette with scalloped bottom */}
                <path
                  d="M 0,0 L 136,0 L 136,54 L 122,66 L 108,54 L 94,66 L 80,54 L 68,66 L 56,54 L 42,66 L 28,54 L 14,66 L 0,54 Z"
                  fill={color.fill}
                  fillOpacity="0.22"
                  stroke={color.stroke}
                  strokeOpacity="0.45"
                  strokeWidth="1"
                />

                {/* Traditional cut-paper geometric lattice & marigold cutout */}
                <rect x="10" y="6" width="116" height="4" rx="1" fill="#0b0a1a" fillOpacity="0.65" />
                {/* Corner diamonds */}
                <polygon points="18,16 24,22 18,28 12,22" fill="#0b0a1a" fillOpacity="0.72" />
                <polygon points="118,16 124,22 118,28 112,22" fill="#0b0a1a" fillOpacity="0.72" />
                <polygon points="18,36 24,42 18,48 12,42" fill="#0b0a1a" fillOpacity="0.72" />
                <polygon points="118,36 124,42 118,48 112,42" fill="#0b0a1a" fillOpacity="0.72" />

                {/* Center cempasúchil rosette cutout */}
                <circle cx="68" cy="31" r="14" fill="none" stroke="#0b0a1a" strokeOpacity="0.7" strokeWidth="2.5" strokeDasharray="5 3" />
                <circle cx="68" cy="31" r="6" fill="#0b0a1a" fillOpacity="0.78" />
                <path
                  d="M 42,31 L 50,26 L 50,36 Z M 94,31 L 86,26 L 86,36 Z"
                  fill="#0b0a1a"
                  fillOpacity="0.72"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
