import { Memory, OfrendaProfile } from '../types';
import { computeMemoryStrength, getStrengthLabel } from './memoryMath';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function resolveImageAsDataUri(src: string): Promise<string> {
  if (!src) return '';
  if (src.startsWith('data:')) return src;
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

export async function exportOfrendaHtml(
  profile: OfrendaProfile,
  memories: Memory[],
  timeTravelDays: number = 0
): Promise<void> {
  const now = Date.now();
  const embeddedPortrait = await resolveImageAsDataUri(profile.portraitBase64);

  const memoryCardsHtml = await Promise.all(
    memories.map(async (m) => {
      const strength = computeMemoryStrength(m, now, timeTravelDays);
      const pct = Math.round(strength * 100);
      const status = getStrengthLabel(strength);
      const photoData = m.photoBase64 ? await resolveImageAsDataUri(m.photoBase64) : '';
      const createdDate = new Date(m.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      return `
        <article class="memory-card" style="opacity: ${Math.max(0.55, 0.5 + strength * 0.5)};">
          <div class="candle-badge">
            <span class="flame-dot ${strength <= 0 ? 'out' : strength < 0.3 ? 'fading' : ''}"></span>
            <span>${pct}% · ${escapeHtml(status)}</span>
            <span>·</span>
            <span>Lit ${escapeHtml(createdDate)}</span>
          </div>
          <h3>${escapeHtml(m.title)}</h3>
          ${
            m.tags.length > 0
              ? `<p class="tags">${m.tags.map((t) => escapeHtml(t)).join(' · ')}</p>`
              : ''
          }
          ${
            photoData
              ? `<figure class="keepsake"><img src="${photoData}" alt="${escapeHtml(
                  m.title
                )}" /></figure>`
              : ''
          }
          <p class="story">${escapeHtml(m.story).replace(/\n/g, '<br/>')}</p>
        </article>
      `;
    })
  );

  const exportedDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ofrenda for ${escapeHtml(profile.honoreeName)} — Candlekeeper</title>
  <style>
    :root {
      color-scheme: dark;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(ellipse 80% 55% at 50% 25%, #1c1638 0%, #0b0a1a 65%, #05050c 100%);
      color: #f5f0e6;
      font-family: Georgia, "Cormorant Garamond", "Times New Roman", serif;
      line-height: 1.7;
      padding: 2.5rem 1.25rem 4rem;
    }
    .container {
      max-width: 780px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      border-bottom: 1px solid rgba(255, 159, 28, 0.28);
      padding-bottom: 2.25rem;
      margin-bottom: 2.5rem;
    }
    .kicker {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 0.75rem;
      letter-spacing: 0.12em;
      color: #ffbf69;
      margin-bottom: 0.75rem;
    }
    .portrait-frame {
      width: 148px;
      height: 188px;
      margin: 0 auto 1.25rem;
      padding: 6px;
      border-radius: 74px 74px 10px 10px;
      background: linear-gradient(180deg, #e6a947, #6f4311);
      box-shadow: 0 0 36px rgba(255, 159, 28, 0.3);
    }
    .portrait-frame img, .portrait-placeholder {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 68px 68px 6px 6px;
      background: #141128;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffbf69;
      font-style: italic;
      font-size: 0.9rem;
      padding: 0.5rem;
    }
    h1 {
      font-size: 2.35rem;
      font-weight: 500;
      margin: 0.25rem 0;
    }
    .epitaph {
      color: rgba(245, 240, 230, 0.7);
      font-size: 0.95rem;
      margin: 0.25rem 0 0;
    }
    .memories-grid {
      display: grid;
      gap: 1.5rem;
    }
    .memory-card {
      background: rgba(18, 16, 38, 0.86);
      border: 1px solid rgba(255, 159, 28, 0.22);
      border-radius: 12px;
      padding: 1.5rem 1.75rem;
    }
    .candle-badge {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 0.75rem;
      color: rgba(245, 240, 230, 0.6);
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin-bottom: 0.5rem;
    }
    .flame-dot {
      width: 8px;
      height: 11px;
      border-radius: 50% 50% 45% 45%;
      background: #ff9f1c;
      box-shadow: 0 0 10px #ff9f1c;
      display: inline-block;
    }
    .flame-dot.fading {
      background: #f59e0b;
      opacity: 0.55;
    }
    .flame-dot.out {
      background: #64748b;
      box-shadow: none;
    }
    h3 {
      font-size: 1.5rem;
      font-weight: 500;
      margin: 0 0 0.25rem;
      color: #fff8eb;
    }
    .tags {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 0.75rem;
      color: #ffbf69;
      margin: 0 0 0.9rem;
    }
    .keepsake {
      margin: 0.75rem 0 1rem;
    }
    .keepsake img {
      max-width: 100%;
      max-height: 280px;
      border-radius: 8px;
      border: 1px solid rgba(255, 159, 28, 0.25);
    }
    .story {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 0.95rem;
      color: rgba(245, 240, 230, 0.88);
      margin: 0;
    }
    footer {
      margin-top: 3rem;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 0.75rem;
      color: rgba(245, 240, 230, 0.45);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="kicker">DÍA DE LOS MUERTOS · OFRENDA ARCHIVE</div>
      <div class="portrait-frame">
        ${
          embeddedPortrait
            ? `<img src="${embeddedPortrait}" alt="${escapeHtml(profile.honoreeName)}" />`
            : `<div class="portrait-placeholder">${escapeHtml(profile.honoreeName)}</div>`
        }
      </div>
      <h1>${escapeHtml(profile.honoreeName)}</h1>
      ${profile.epitaph ? `<p class="epitaph">${escapeHtml(profile.epitaph)}</p>` : ''}
    </header>
    <main class="memories-grid">
      ${
        memoryCardsHtml.length > 0
          ? memoryCardsHtml.join('\n')
          : '<p style="text-align:center;font-style:italic;color:rgba(245,240,230,0.6);">No candles were lit at the time of export.</p>'
      }
    </main>
    <footer>
      Exported offline from Candlekeeper on ${escapeHtml(
        exportedDate
      )} · Self-contained keepsake file. Your memories never leave your device.
    </footer>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeSlug = profile.honoreeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'ofrenda';
  link.href = url;
  link.download = `candlekeeper-${safeSlug}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
