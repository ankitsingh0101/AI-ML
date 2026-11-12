import React from 'react';
import { motion } from 'motion/react';
import { ParticleSanctuary } from './ParticleSanctuary';

interface GhostLayerProps {
  reducedMotion: boolean;
}

const AMBIENT_WISPS = [
  {
    id: 'wisp-1',
    width: 240,
    height: 150,
    initialX: '8vw',
    initialY: '18vh',
    pathX: ['8vw', '26vw', '14vw', '8vw'],
    pathY: ['18vh', '12vh', '28vh', '18vh'],
    duration: 34,
    opacity: [0.05, 0.12, 0.07, 0.05],
  },
  {
    id: 'wisp-2',
    width: 310,
    height: 180,
    initialX: '68vw',
    initialY: '14vh',
    pathX: ['68vw', '52vw', '74vw', '68vw'],
    pathY: ['14vh', '24vh', '19vh', '14vh'],
    duration: 42,
    opacity: [0.04, 0.1, 0.06, 0.04],
  },
  {
    id: 'wisp-3',
    width: 190,
    height: 220,
    initialX: '34vw',
    initialY: '42vh',
    pathX: ['34vw', '48vw', '28vw', '34vw'],
    pathY: ['42vh', '30vh', '46vh', '42vh'],
    duration: 38,
    opacity: [0.03, 0.09, 0.05, 0.03],
  },
  {
    id: 'wisp-4',
    width: 260,
    height: 140,
    initialX: '15vw',
    initialY: '62vh',
    pathX: ['15vw', '32vw', '19vw', '15vw'],
    pathY: ['62vh', '52vh', '68vh', '62vh'],
    duration: 46,
    opacity: [0.04, 0.11, 0.05, 0.04],
  },
  {
    id: 'wisp-5',
    width: 220,
    height: 190,
    initialX: '76vw',
    initialY: '54vh',
    pathX: ['76vw', '61vw', '82vw', '76vw'],
    pathY: ['54vh', '43vh', '60vh', '54vh'],
    duration: 39,
    opacity: [0.04, 0.1, 0.06, 0.04],
  },
  {
    id: 'wisp-6',
    width: 280,
    height: 160,
    initialX: '46vw',
    initialY: '20vh',
    pathX: ['46vw', '35vw', '56vw', '46vw'],
    pathY: ['20vh', '11vh', '25vh', '20vh'],
    duration: 51,
    opacity: [0.03, 0.08, 0.04, 0.03],
  },
];

const MARIGOLD_PETALS = [
  { id: 'petal-1', startX: '14%', driftX: '22%', duration: 19, delay: 0, size: 9, rotate: 210 },
  { id: 'petal-2', startX: '29%', driftX: '24%', duration: 23, delay: 4.5, size: 11, rotate: -185 },
  { id: 'petal-3', startX: '47%', driftX: '53%', duration: 21, delay: 9, size: 8, rotate: 260 },
  { id: 'petal-4', startX: '63%', driftX: '58%', duration: 25, delay: 2.5, size: 10, rotate: -220 },
  { id: 'petal-5', startX: '78%', driftX: '84%', duration: 20, delay: 12, size: 9, rotate: 195 },
  { id: 'petal-6', startX: '38%', driftX: '33%', duration: 27, delay: 15.5, size: 7, rotate: -160 },
  { id: 'petal-7', startX: '88%', driftX: '81%', duration: 22, delay: 7, size: 10, rotate: 240 },
];

export const GhostLayer: React.FC<GhostLayerProps> = ({ reducedMotion }) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden z-0"
    >
      {/* Deep midnight indigo to near-black sanctuary backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% 42%, rgba(28, 22, 56, 0.55) 0%, rgba(11, 10, 26, 0.94) 62%, #05050c 100%)',
        }}
      />

      {/* tsParticles background layer: upward soft white-blue wisps + sparse marigold embers (disabled on reducedMotion) */}
      <ParticleSanctuary reducedMotion={reducedMotion} />

      {/* Framer Motion ambient ghostly wisps (6 translucent soft blurred white-blue shapes) */}
      {!reducedMotion ? (
        AMBIENT_WISPS.map((wisp) => (
          <motion.div
            key={wisp.id}
            initial={{ x: wisp.initialX, y: wisp.initialY, opacity: wisp.opacity[0] }}
            animate={{
              x: wisp.pathX,
              y: wisp.pathY,
              opacity: wisp.opacity,
            }}
            transition={{
              duration: wisp.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ width: wisp.width, height: wisp.height }}
            className="absolute rounded-full blur-3xl bg-gradient-to-br from-sky-200/40 via-indigo-200/25 to-transparent"
          />
        ))
      ) : (
        <div className="absolute top-1/4 left-1/3 w-80 h-48 rounded-full blur-3xl bg-sky-200/[0.04]" />
      )}

      {/* Floating marigold petals drifting gently down */}
      {!reducedMotion &&
        MARIGOLD_PETALS.map((petal) => (
          <motion.div
            key={petal.id}
            initial={{
              left: petal.startX,
              top: '-4%',
              opacity: 0,
              rotate: 0,
            }}
            animate={{
              left: [petal.startX, petal.driftX, petal.startX],
              top: ['-4%', '52%', '104%'],
              opacity: [0, 0.65, 0.55, 0],
              rotate: [0, petal.rotate * 0.5, petal.rotate],
            }}
            transition={{
              duration: petal.duration,
              delay: petal.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="absolute"
          >
            <svg
              width={petal.size * 1.6}
              height={petal.size * 1.1}
              viewBox="0 0 18 12"
              className="drop-shadow-[0_0_6px_rgba(255,159,28,0.35)]"
            >
              <path
                d="M1,6 C4,1 12,0 17,5 C15,9 8,12 1,6 Z"
                fill="url(#marigoldPetalGrad)"
              />
              <defs>
                <linearGradient id="marigoldPetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffbf69" />
                  <stop offset="65%" stopColor="#ff9f1c" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        ))}

      {/* Soft moving fog layer at the bottom */}
      {!reducedMotion ? (
        <>
          <motion.div
            animate={{ x: ['-6%', '6%', '-6%'], opacity: [0.26, 0.38, 0.26] }}
            transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-12 -left-1/4 w-[150%] h-48 blur-3xl bg-gradient-to-t from-indigo-950/65 via-slate-800/20 to-transparent"
          />
          <motion.div
            animate={{ x: ['5%', '-7%', '5%'], opacity: [0.18, 0.3, 0.18] }}
            transition={{ duration: 36, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-8 -left-1/4 w-[150%] h-36 blur-2xl bg-gradient-to-t from-sky-200/[0.07] via-amber-500/[0.03] to-transparent"
          />
        </>
      ) : (
        <div className="absolute bottom-0 inset-x-0 h-36 blur-2xl bg-gradient-to-t from-indigo-950/50 to-transparent" />
      )}

      {/* Subtle film-grain SVG noise texture */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.035] mix-blend-overlay">
        <filter id="candlekeeper-film-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.78"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#candlekeeper-film-grain)" />
      </svg>

      {/* Soft cinematic vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, transparent 45%, rgba(4, 3, 10, 0.72) 100%)',
        }}
      />
    </div>
  );
};
