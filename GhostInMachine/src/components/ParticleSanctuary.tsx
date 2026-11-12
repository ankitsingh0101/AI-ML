import React, { useMemo } from 'react';
import { Particles, ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { Engine, ISourceOptions } from '@tsparticles/engine';

interface ParticleSanctuaryProps {
  reducedMotion: boolean;
}

// Stable module-level init callback required by ParticlesProvider across the app lifecycle
const initSlimEngine = async (engine: Engine): Promise<void> => {
  await loadSlim(engine);
};

export const ParticleSanctuary: React.FC<ParticleSanctuaryProps> = ({ reducedMotion }) => {
  const options: ISourceOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      detectRetina: true,
      // Primary particle field: soft translucent white-blue spirit wisps drifting slowly upward
      particles: {
        number: {
          value: 20,
          density: {
            enable: true,
            width: 1200,
            height: 800,
          },
        },
        color: {
          value: ['#dbeafe', '#bfdbfe', '#e0e7ff'],
        },
        shape: {
          type: 'circle',
        },
        opacity: {
          value: { min: 0.04, max: 0.16 },
          animation: {
            enable: true,
            speed: 0.35,
            sync: false,
          },
        },
        size: {
          value: { min: 4, max: 14 },
          animation: {
            enable: true,
            speed: 0.8,
            sync: false,
          },
        },
        move: {
          enable: true,
          direction: 'top',
          speed: { min: 0.18, max: 0.45 },
          random: true,
          straight: false,
          outModes: {
            default: 'out',
          },
        },
      },
      // Secondary emitter: sparse marigold-colored embers floating upward like candle sparks
      emitters: [
        {
          position: { x: 50, y: 96 },
          size: { width: 85, height: 6 },
          rate: {
            delay: 0.65,
            quantity: 1,
          },
          particles: {
            color: {
              value: ['#ff9f1c', '#ffbf69', '#f59e0b'],
            },
            shape: {
              type: 'circle',
            },
            opacity: {
              value: { min: 0.12, max: 0.42 },
              animation: {
                enable: true,
                speed: 0.5,
                sync: false,
              },
            },
            size: {
              value: { min: 1.2, max: 3.2 },
            },
            move: {
              enable: true,
              direction: 'top',
              speed: { min: 0.28, max: 0.65 },
              random: true,
              straight: false,
              outModes: {
                default: 'out',
              },
            },
          },
        },
      ],
      interactivity: {
        events: {
          resize: { enable: true },
        },
      },
    }),
    []
  );

  // Respect prefers-reduced-motion by disabling particles completely
  if (reducedMotion) {
    return null;
  }

  return (
    <ParticlesProvider init={initSlimEngine}>
      <Particles
        id="candlekeeper-tsparticles"
        options={options}
        className="pointer-events-none absolute inset-0 w-full h-full z-0"
      />
    </ParticlesProvider>
  );
};
