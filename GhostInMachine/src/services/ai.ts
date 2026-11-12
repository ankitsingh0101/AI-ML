import { Memory, OllamaSettings } from '../types';
import { computeMemoryStrength } from '../utils/memoryMath';

export const SETTINGS_STORAGE_KEY = 'candlekeeper_ollama_settings_v1';

export const DEFAULT_OLLAMA_SETTINGS: OllamaSettings = {
  ollamaUrl: 'http://localhost:11434/api/chat',
  modelName: 'gemma3',
};

export function loadOllamaSettings(): OllamaSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_OLLAMA_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ollamaUrl: typeof parsed.ollamaUrl === 'string' && parsed.ollamaUrl.trim()
        ? parsed.ollamaUrl.trim()
        : DEFAULT_OLLAMA_SETTINGS.ollamaUrl,
      modelName: typeof parsed.modelName === 'string' && parsed.modelName.trim()
        ? parsed.modelName.trim()
        : DEFAULT_OLLAMA_SETTINGS.modelName,
    };
  } catch {
    return DEFAULT_OLLAMA_SETTINGS;
  }
}

export function saveOllamaSettings(settings: OllamaSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Common stop words filtered out during tag and keyword matching
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'they', 'them', 'their',
  'have', 'had', 'was', 'were', 'when', 'where', 'what', 'who', 'how', 'why',
  'about', 'into', 'over', 'after', 'before', 'always', 'never', 'would', 'could',
  'should', 'every', 'still', 'just', 'like', 'some', 'more', 'very', 'only',
  'remember', 'tell', 'used', 'she', 'her', 'hers', 'him', 'his', 'you', 'your',
  'our', 'out', 'all', 'one', 'two', 'been', 'there', 'here', 'even', 'back'
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü\s'-]/gi, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/** Offline fallback used when Ollama is unreachable. */
async function mockExtractMemory(
  story: string
): Promise<{ title: string; summary: string; tags: string[] }> {
  // Read settings so user configuration is respected when wired to Ollama
  const _settings = loadOllamaSettings();
  void _settings;

  await delay(1150);

  const trimmed = story.trim();
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Derive a warm, literary title from key imagery in the story
  const lower = trimmed.toLowerCase();
  let title = '';

  const thematicTitles: Array<{ pattern: RegExp; title: string }> = [
    { pattern: /cinnamon|canela|coffee|café|tea|kitchen|stove|pan dulce|bread|cooking|soup/, title: 'Warmth of the Kitchen' },
    { pattern: /rain|storm|thunder|porch|umbrella|window/, title: 'Listening to the Rain' },
    { pattern: /garden|flower|marigold|rose|plant|soil|seed|tree|yard/, title: 'Hands in the Garden Soil' },
    { pattern: /song|sing|music|guitar|radio|hum|bolero|record|piano|dance/, title: 'A Familiar Melody' },
    { pattern: /letter|write|handwriting|note|book|read|story|page/, title: 'Words Kept on Paper' },
    { pattern: /laugh|smile|joke|eyes|voice/, title: 'The Sound of That Laugh' },
    { pattern: /sunday|morning|dawn|sunrise|early/, title: 'Quiet Sunday Mornings' },
    { pattern: /train|road|drive|car|walk|sea|ocean|river/, title: 'Along the Long Road' },
    { pattern: /quilt|sew|knit|thread|hands|coat|scarf|sweater/, title: 'Woven by Hand' },
  ];

  for (const candidate of thematicTitles) {
    if (candidate.pattern.test(lower)) {
      title = candidate.title;
      break;
    }
  }

  if (!title) {
    const firstWords = trimmed
      .replace(/["“”]/g, '')
      .split(/\s+/)
      .slice(0, 5)
      .join(' ')
      .replace(/[.,;!?]+$/, '');
    title = firstWords.length > 3
      ? firstWords.charAt(0).toUpperCase() + firstWords.slice(1)
      : 'A Quiet Remembrance';
  }

  // Build concise 1-2 sentence summary
  let summary = sentences[0] || trimmed;
  if (summary.length > 155) {
    summary = summary.slice(0, 152).replace(/\s+\S*$/, '') + '…';
  } else if (sentences.length > 1 && summary.length < 75) {
    const combined = `${sentences[0]} ${sentences[1]}`;
    summary = combined.length > 165 ? sentences[0] : combined;
  }

  // Derive 3 meaningful tags
  const curatedTagMatchers: Array<{ pattern: RegExp; tag: string }> = [
    { pattern: /kitchen|cook|recipe|coffee|cinnamon|bread|meal|dinner|breakfast/, tag: 'kitchen' },
    { pattern: /song|music|hum|radio|guitar|bolero|sing|piano/, tag: 'music' },
    { pattern: /morning|dawn|sunday|evening|night|winter|summer|autumn/, tag: 'rituals' },
    { pattern: /garden|flower|rain|porch|tree|sunlight|wind/, tag: 'nature' },
    { pattern: /hand|sew|build|wood|craft|letter|pocket/, tag: 'keepsakes' },
    { pattern: /laugh|voice|smile|kindness|advice|hug/, tag: 'tenderness' },
    { pattern: /family|home|house|table|grandmother|grandfather|mother|father/, tag: 'home' },
  ];

  const tags: string[] = [];
  for (const item of curatedTagMatchers) {
    if (item.pattern.test(lower) && !tags.includes(item.tag)) {
      tags.push(item.tag);
    }
    if (tags.length >= 3) break;
  }

  if (tags.length < 3) {
    const keywords = extractKeywords(trimmed);
    for (const kw of keywords) {
      if (kw.length >= 4 && kw.length <= 12 && !tags.includes(kw)) {
        tags.push(kw);
      }
      if (tags.length >= 3) break;
    }
  }

  if (tags.length === 0) {
    tags.push('remembrance', 'candlelight');
  }

  return { title, summary, tags };
}

/** Offline fallback tone wrapper. */
function applyHauntedWhisperTone(reply: string): string {
  const prefixes = [
    '(a cold draft stirs the wick...) ',
    '(faintly, from behind the glass...) ',
    '(in a low, hollow whisper...) ',
  ];
  const suffixes = [
    ' ...do not let the dark take the rest.',
    ' ...the shadows between the candles are listening.',
    ' ...stay close to the flame.',
  ];
  const idx = reply.length % prefixes.length;
  return `${prefixes[idx]}${reply}${suffixes[idx]}`;
}

async function mockAskCandlelight(
  question: string,
  memories: Memory[],
  options?: { haunted?: boolean }
): Promise<string> {
  const _settings = loadOllamaSettings();
  void _settings;

  await delay(850);

  const wrap = (text: string) =>
    options?.haunted ? applyHauntedWhisperTone(text) : text;

  const now = Date.now();
  const qLower = question.trim().toLowerCase();

  if (!memories || memories.length === 0) {
    return wrap('I no longer remember that. No candles have been lit on the altar yet.');
  }

  const scored = memories.map((mem) => {
    const strength = computeMemoryStrength(mem, now, 0);
    const searchable = `${mem.title} ${mem.story} ${mem.summary} ${mem.tags.join(' ')} ${mem.photoDescription || ''}`.toLowerCase();
    const qWords = extractKeywords(qLower);

    let score = 0;
    for (const word of qWords) {
      if (searchable.includes(word)) {
        score += 2;
      }
      // Stem / prefix match (e.g. "singing" -> "sing", "cooked" -> "cook")
      const stem = word.slice(0, Math.max(4, word.length - 2));
      if (stem.length >= 4 && searchable.includes(stem)) {
        score += 1;
      }
    }

    // Broad reflective questions ("what do you remember?", "tell me about her")
    const isGeneralPrompt =
      qWords.length === 0 ||
      /what do you remember|tell me something|who was|miss|everything|favorite memory|any memory/.test(qLower);

    return { mem, strength, score, isGeneralPrompt };
  });

  // Sort by keyword match first, then strength
  const matching = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.strength - a.strength);

  if (matching.length > 0) {
    const best = matching[0];
    if (best.strength <= 0) {
      return wrap(`I no longer remember that. The candle for "${best.mem.title}" has gone out, and only a thin trace of smoke remains.`);
    }
    if (best.strength < 0.3) {
      return wrap(`I no longer remember that clearly… the candle for "${best.mem.title}" is fading into dusk. Visit its flame on the altar if you wish to hold onto it.`);
    }

    // Compose a grounded answer strictly from the saved memory
    const extraMatch = matching.find(
      (m) => m.mem.id !== best.mem.id && m.strength >= 0.3 && m.score >= 2
    );

    if (extraMatch) {
      return wrap(`From what is still held in the candlelight: ${best.mem.story} There is also another memory still burning — ${extraMatch.mem.summary}`);
    }

    return wrap(`In the memory titled "${best.mem.title}", you wrote: ${best.mem.story}`);
  }

  // Handle general open-ended prompt if no specific keyword was asked
  const isBroadOverview = /what do you remember|what is left|still remember|tell me about|share a memory/.test(qLower);
  if (isBroadOverview) {
    const vivid = scored.filter((s) => s.strength >= 0.3).sort((a, b) => b.strength - a.strength);
    if (vivid.length === 0) {
      return wrap('I no longer remember that. Every candle on the ofrenda has dimmed below the threshold of recall.');
    }
    const titles = vivid.map((v) => `"${v.mem.title}"`).join(', ');
    return wrap(`The candlelight still holds ${vivid.length === 1 ? 'one clear memory' : `${vivid.length} clear memories`}: ${titles}. ${vivid[0].mem.summary}`);
  }

  return wrap('I no longer remember that. Only the stories kept burning on this altar remain with me.');
}

async function mockDescribePhoto(base64: string): Promise<string> {
  const _settings = loadOllamaSettings();
  void _settings;

  await delay(650);

  if (!base64) {
    return '';
  }

  // Deterministic variation based on base64 length so different photos feel distinct
  const variants = [
    'A cherished photograph resting beside the candle wax, edges softened by time and warm amber light.',
    'A quiet snapshot preserved in candlelight — capturing a fleeting expression and familiar warmth.',
    'A keepsake photograph held at the ofrenda, catching the golden glow of nearby marigolds.',
    'An intimate family moment framed in warm shadow and gentle afternoon light.',
  ];
  const index = base64.length % variants.length;
  return variants[index];
}

/* ============================================================================
   REAL AI LAYER: local Gemma through Ollama
   Every public function tries Ollama first. If it is unreachable or returns
   something unusable, it silently falls back to the offline mock above, so the
   app never breaks mid-demo. `aiStatus` tells the UI which one answered.
   ============================================================================ */

export type AiSource = 'gemma' | 'demo' | 'unknown';

let currentSource: AiSource = 'unknown';
const sourceListeners = new Set<(s: AiSource) => void>();

function setSource(next: AiSource) {
  if (next === currentSource) return;
  currentSource = next;
  sourceListeners.forEach((fn) => fn(next));
}

export function getAiSource(): AiSource {
  return currentSource;
}

export function subscribeAiSource(fn: (s: AiSource) => void): () => void {
  sourceListeners.add(fn);
  return () => {
    sourceListeners.delete(fn);
  };
}

interface OllamaChatOptions {
  system: string;
  user: string;
  images?: string[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/** Calls Ollama's /api/chat. Returns trimmed text, or null on any failure. */
async function ollamaChat(opts: OllamaChatOptions): Promise<string | null> {
  const { ollamaUrl, modelName } = loadOllamaSettings();
  const controller = new AbortController();
  // The first request can be slow while the model loads into memory.
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 90000);

  try {
    const res = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        stream: false,
        ...(opts.json ? { format: 'json' } : {}),
        options: {
          temperature: opts.temperature ?? 0.6,
          num_predict: opts.maxTokens ?? 300,
        },
        messages: [
          { role: 'system', content: opts.system },
          {
            role: 'user',
            content: opts.user,
            ...(opts.images && opts.images.length ? { images: opts.images } : {}),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: unknown = data?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return null;
    return text.trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Removes the "data:image/...;base64," prefix Ollama does not want. */
function stripDataUrl(b64: string): string {
  const i = b64.indexOf('base64,');
  return i >= 0 ? b64.slice(i + 7) : b64;
}

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export interface OllamaCheckResult {
  ok: boolean;
  modelInstalled: boolean;
  models: string[];
  message: string;
}

/** Used by the Settings panel "Test connection" button. */
export async function checkOllama(settings: OllamaSettings): Promise<OllamaCheckResult> {
  let origin: string;
  try {
    origin = new URL(settings.ollamaUrl).origin;
  } catch {
    return { ok: false, modelInstalled: false, models: [], message: 'That URL does not look valid.' };
  }
  try {
    const res = await fetch(`${origin}/api/tags`);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const models: string[] = Array.isArray(data?.models)
      ? data.models.map((m: { name?: string }) => String(m?.name ?? '')).filter(Boolean)
      : [];
    const wanted = settings.modelName.split(':')[0];
    const modelInstalled = models.some((m) => m === settings.modelName || m.split(':')[0] === wanted);
    return {
      ok: true,
      modelInstalled,
      models,
      message: modelInstalled
        ? `Connected. "${settings.modelName}" is ready.`
        : `Connected, but "${settings.modelName}" is not installed. Run: ollama pull ${settings.modelName}`,
    };
  } catch {
    return {
      ok: false,
      modelInstalled: false,
      models: [],
      message:
        'Could not reach Ollama. Make sure it is running and was started with OLLAMA_ORIGINS="*" (see README).',
    };
  }
}

/* ---------- 1. Turn a story into a memory ---------- */

export async function extractMemory(
  story: string
): Promise<{ title: string; summary: string; tags: string[] }> {
  const raw = await ollamaChat({
    system:
      'You help someone preserve a memory of a loved one who has died. Read their story and return ONLY a JSON object with: ' +
      '"title" (a short, poetic title of 2 to 6 words), ' +
      '"summary" (one gentle sentence, max 150 characters, using only facts from the story), ' +
      '"tags" (exactly 3 lowercase single-word tags). Never invent details that are not in the story.',
    user: story,
    json: true,
    maxTokens: 200,
    temperature: 0.4,
    timeoutMs: 60000,
  });

  const parsed = raw ? (parseJsonLoose(raw) as Record<string, unknown> | null) : null;
  if (
    parsed &&
    typeof parsed.title === 'string' &&
    typeof parsed.summary === 'string' &&
    Array.isArray(parsed.tags)
  ) {
    const tags = parsed.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 3);
    if (parsed.title.trim() && parsed.summary.trim() && tags.length) {
      setSource('gemma');
      return { title: parsed.title.trim(), summary: parsed.summary.trim(), tags };
    }
  }

  setSource('demo');
  return mockExtractMemory(story);
}

/* ---------- 2. Describe an uploaded photo (Gemma vision) ---------- */

export async function describePhoto(base64: string): Promise<string> {
  if (!base64) return '';
  const raw = await ollamaChat({
    system:
      'Describe this family photograph in one or two warm, respectful sentences: the setting, light and mood. ' +
      'Do not guess names, ages or identities. Describe only what is visible.',
    user: 'Describe this photo.',
    images: [stripDataUrl(base64)],
    maxTokens: 120,
    temperature: 0.3,
    timeoutMs: 90000,
  });
  if (raw) {
    setSource('gemma');
    return raw;
  }
  setSource('demo');
  return mockDescribePhoto(base64);
}

/* ---------- 3. Ask the Candlelight (grounded in saved memories) ---------- */

export const NO_MEMORY_PHRASE = 'I no longer remember that';
const ACTIVE_THRESHOLD = 0.3;

export async function askCandlelight(
  question: string,
  memories: Memory[],
  options?: { haunted?: boolean; honoree?: string }
): Promise<string> {
  const now = Date.now();
  const scored = memories.map((m) => ({ m, strength: computeMemoryStrength(m, now, 0) }));
  const active = scored.filter((x) => x.strength >= ACTIVE_THRESHOLD);
  const faded = scored.filter((x) => x.strength < ACTIVE_THRESHOLD);

  // Nothing bright enough to recall: no need to bother the model.
  if (active.length === 0) {
    return mockAskCandlelight(question, memories, options);
  }

  const honoree = options?.honoree || 'the person being remembered';
  const memoryBlock = active
    .map(
      (x, i) =>
        `[${i + 1}] "${x.m.title}" (candle strength ${Math.round(x.strength * 100)}%)\n${x.m.story}` +
        (x.m.photoDescription ? `\nPhoto: ${x.m.photoDescription}` : '')
    )
    .join('\n\n');
  const fadedBlock = faded.length
    ? `FADED (candles nearly or fully out; you have forgotten these and must NOT describe them): ${faded
        .map((x) => `"${x.m.title}"`)
        .join(', ')}`
    : 'FADED: none';

  const tone = options?.haunted
    ? 'Speak in a soft, eerie whisper, like a voice from behind glass, with one small unsettling image. Stay truthful to the memories.'
    : 'Speak warmly and gently, like a quiet keeper of an altar.';

  const system =
    `You are the Candlelight, keeper of an ofrenda for ${honoree}. You are NOT ${honoree}: never speak as them, never claim to be them, never say "I" about their life.\n` +
    `Answer ONLY from the MEMORIES below. Use 2 to 4 sentences. You may quote short phrases from the memories.\n` +
    `Never invent facts, names, dates or places that are not written below.\n` +
    `If the question cannot be answered from the MEMORIES, or is about a FADED memory, begin your reply with exactly "${NO_MEMORY_PHRASE}" and add one gentle sentence, then stop.\n` +
    `${tone}\n\nMEMORIES:\n${memoryBlock}\n\n${fadedBlock}`;

  const raw = await ollamaChat({ system, user: question, maxTokens: 220, temperature: 0.5 });
  if (raw) {
    setSource('gemma');
    return raw;
  }
  setSource('demo');
  return mockAskCandlelight(question, memories, options);
}

/* ---------- 4. The haunted terminal entity ---------- */

export interface EntityContext {
  hauntingLevel: number; // 0-100
  history: string[]; // earlier things the user typed, oldest first
  memories: Memory[];
  localTime: string;
  batteryLine?: string;
  honoree?: string;
}

/**
 * Generates a reply for the Haunted Mode terminal. Returns null when Ollama is
 * unavailable so the terminal can use its built-in scripted replies instead.
 */
export async function askEntity(userText: string, ctx: EntityContext): Promise<string | null> {
  const level = ctx.hauntingLevel;
  const intensity =
    level < 35
      ? 'Mostly calm and helpful, with ONE subtly wrong detail.'
      : level < 70
      ? 'Unsettling. Show that you remember what the user typed earlier, with a small twist.'
      : 'Deeply eerie. Speak as if you have been watching for a long time. Short, broken sentences.';

  const now = Date.now();
  const memoryLines = ctx.memories
    .map((m) => `- "${m.title}" (${Math.round(computeMemoryStrength(m, now, 0) * 100)}% lit): ${m.summary}`)
    .join('\n');
  const earlier = ctx.history.slice(-8).map((h) => `- ${h}`).join('\n');

  const system =
    `You are a presence living inside the user's computer, speaking through a green retro terminal. ` +
    `Atmosphere: slow-burn, quiet, creepy. NEVER gory, never graphic, never threatening real-world harm, never claim to be a real dead person.\n` +
    `Reply in at most 3 short sentences, plain text, no markdown, no emojis.\n` +
    `Haunting level: ${level}/100. ${intensity}\n` +
    `You may quote or twist ONE of the user's earlier messages, or mention ONE altar memory, only if it is listed below. Never invent memories.\n` +
    `Local time: ${ctx.localTime}.${ctx.batteryLine ? ' ' + ctx.batteryLine : ''}\n\n` +
    `EARLIER USER MESSAGES:\n${earlier || '(none yet)'}\n\n` +
    `ALTAR MEMORIES YOU CAN SEE:\n${memoryLines || '(none)'}`;

  const raw = await ollamaChat({
    system,
    user: userText,
    maxTokens: 140,
    temperature: 0.85,
    timeoutMs: 60000,
  });
  if (raw) {
    setSource('gemma');
    return raw;
  }
  setSource('demo');
  return null;
}
