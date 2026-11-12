import { Memory, OfrendaProfile } from '../types';
import { MS_PER_DAY } from '../utils/memoryMath';
import defaultPortraitUrl from '../assets/images/abuela_elena_portrait_1793285200092.jpg';

export const DEFAULT_PROFILE: OfrendaProfile = {
  honoreeName: 'Abuela Elena Morales',
  epitaph: '1941 – 2023 · Kept in marigold light and cinnamon steam',
  portraitBase64: defaultPortraitUrl,
};

export function createSeedMemories(nowMs: number = Date.now()): Memory[] {
  return [
    {
      id: 'seed-cinnamon-coffee',
      title: 'Café de Olla Before Dawn',
      story:
        'Before anyone else in the house was awake, she stood barefoot by the blue enamel stove crushing Ceylon cinnamon sticks with the flat of a wooden spoon. She always poured two clay mugs of café de olla even when she lived alone—one for herself, and one by the window in case a neighbor or an old memory walked up the front steps.',
      summary:
        'Crushing cinnamon sticks at dawn by the blue enamel stove, always pouring a second clay mug of café de olla by the window.',
      tags: ['kitchen', 'rituals', 'cinnamon'],
      createdAt: nowMs - 3 * MS_PER_DAY,
      lastRecalledAt: nowMs - 1.2 * MS_PER_DAY, // strength ~ 0.92 (radiant)
      tier: 2,
    },
    {
      id: 'seed-sunday-boleros',
      title: 'Humming Boleros in the Rain',
      story:
        'Whenever afternoon thunder rolled across the valley, she unplugged the television, propped open the cedar screen door, and hummed Los Panchos boleros slightly slower than the radio ever played them. She told me rain was the only time the house knew how to listen properly, pressing warm tortillas in a linen cloth while water drummed on the tin roof.',
      summary:
        'Opening the cedar screen door during summer rainstorms to hum Los Panchos boleros while keeping tortillas warm in linen.',
      tags: ['music', 'rain', 'home'],
      createdAt: nowMs - 16 * MS_PER_DAY,
      lastRecalledAt: nowMs - 8.5 * MS_PER_DAY, // strength ~ 0.54 (steady)
      tier: 2,
    },
    {
      id: 'seed-marigold-seeds',
      title: 'Seeds Folded in Newspaper',
      story:
        'Every November she dried the darkest cempasúchil heads on the back windowsill and folded their black, needle-thin seeds into squares of yesterday’s newspaper. Across each packet she penciled the year in crooked cursive and slipped them into my coat pocket as I left, saying next autumn would arrive faster than I thought.',
      summary:
        'Saving dried marigold seeds in dated squares of newspaper and slipping them into my coat pocket each November.',
      tags: ['nature', 'keepsakes', 'autumn'],
      createdAt: nowMs - 32 * MS_PER_DAY,
      lastRecalledAt: nowMs - 19.5 * MS_PER_DAY, // strength ~ 0.248 (< 0.3, fading!)
      tier: 3,
    },
  ];
}
