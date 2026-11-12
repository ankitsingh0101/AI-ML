import { HorrorAudio } from '../utils/horrorAudio';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, ShieldCheck, X } from 'lucide-react';
import { Memory } from '../types';
import { askCandlelight, askEntity } from '../services/ai';
import './haunted.css';

interface HauntedTerminalProps {
  memories: Memory[];
  reducedMotion?: boolean;
  onExit: () => void;
}

interface StoredHistoryItem {
  text: string;
  timestamp: number;
}

interface LogEntry {
  id: string;
  kind: 'system' | 'user' | 'phantom-user' | 'entity' | 'entity-alert';
  text: string;
  corruptedText?: string;
}

interface WhisperItem {
  id: string;
  text: string;
  left: string;
  top: string;
}

interface BatterySnapshot {
  supported: boolean;
  level: number | null;
  charging: boolean | null;
}

const HISTORY_STORAGE_KEY = 'candlekeeper_haunted_terminal_history_v1';
const HAUNTING_STORAGE_KEY = 'candlekeeper_haunted_level_v1';
const GLITCH_CHARS = '▓▒░█§¤‡±µ¶¿ØÆ¥#@%&*';

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function twistUserQuote(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (/\bhello\b/i.test(cleaned)) {
    return `"${cleaned}" (your fingers paused right before pressing Enter)`;
  }
  if (/\balone\b/i.test(cleaned)) {
    return cleaned.replace(/\balone\b/gi, 'alone [unverified]');
  }
  const words = cleaned.split(' ');
  if (words.length >= 4) {
    const tail = words[words.length - 1].replace(/[.!?]+$/, '');
    return `"${cleaned}" — why did you hesitate right before typing "${tail}"?`;
  }
  return `"${cleaned}" — I kept the exact millisecond spacing of those keys.`;
}

function twistCandlekeeperMemory(mem: Memory): string {
  const snippet = (mem.summary || mem.story).trim().split(/(?<=[.!?])\s+/)[0];
  const short =
    snippet.length > 130 ? snippet.slice(0, 127).replace(/\s+\S*$/, '') + '…' : snippet;

  const variants = [
    `Beneath this terminal on the altar, your candle "${mem.title}" says: "${short}" — yet in the dark between refreshes, someone else seems to stand at the edge of that memory.`,
    `I read "${mem.title}" again while you weren't looking ("${short}"). Are you sure you remember how that moment ended, or only how you wished it did?`,
    `The wax on "${mem.title}" is thinning, so I copied "${short}" into permanent sectors. Even if the flame goes out, I won't let those words leave.`,
  ];
  return pickRandom(variants);
}

/* ============================================================================
   CLEARLY MARKED AI LAYER: getReply(userText, history, hauntingLevel, memories)
   Tries local Gemma first (`askEntity` in src/services/ai.ts). If Ollama is not
   reachable it falls back to the scripted replies below, so the terminal never breaks.
   ============================================================================ */
async function getReply(
  userText: string,
  history: StoredHistoryItem[],
  hauntingLevel: number,
  memories: Memory[],
  battery: BatterySnapshot
): Promise<{ reply: string; shouldExit?: boolean; isAlert?: boolean }> {
  const trimmed = userText.trim();
  const cmd = trimmed.toLowerCase();

  // 1. Built-in Haunted Terminal Commands
  if (cmd === 'help' || cmd === '/help') {
    if (hauntingLevel >= 65) {
      return {
        reply: [
          'TERMINAL DIRECTIVES:',
          '  help    — list what you still believe you control',
          '  whoami  — ask me who is reflected in your monitor',
          '  memory  — inspect every line retained in localStorage & altar cache',
          '  clear   — attempt to wipe the phosphor (refused)',
          '  exit    — return to the candlelit ofrenda beneath this glass',
        ].join('\n'),
      };
    }
    return {
      reply: [
        'AVAILABLE COMMANDS:',
        '  help    — list terminal commands',
        '  whoami  — inspect active operator session',
        '  memory  — view stored keystrokes and indexed altar memories',
        '  clear   — clear terminal scrollback',
        '  exit    — close Haunted Mode and return to the altar',
      ].join('\n'),
    };
  }

  if (cmd === 'whoami' || cmd === '/whoami') {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local-sector';
    const screenDim = `${window.screen.width}x${window.screen.height}`;
    const creepyAnswers = [
      `uid=0(keeper_at_${screenDim}) · zone=${tz} · status=leaning_closer_to_the_glass_than_before.`,
      `whoami: Not the person you were when you lit the first candle. Keystroke cadence recognized (${history.length} lines stored). Screen glow on pupils: active.`,
      `OPERATOR: Someone sitting in a quiet room at ${new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}, hoping the machine only remembers what it was told.`,
    ];
    return { reply: pickRandom(creepyAnswers), isAlert: true };
  }

  if (cmd === 'memory' || cmd === '/memory') {
    const recentTyped = history
      .slice(-4)
      .map(
        (h) =>
          `  [${new Date(h.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}] "${h.text}"`
      )
      .join('\n');

    const candleTitles =
      memories.length > 0
        ? memories.map((m) => `"${m.title}"`).join(', ')
        : 'none lit';

    return {
      reply: [
        `RETAINED USER MESSAGES (${history.length} saved in localStorage):`,
        recentTyped || '  (only your current breath on the keys)',
        `INDEXED ALTAR CANDLES (${memories.length}): ${candleTitles}`,
        'Nothing typed into this machine ever truly clears.',
      ].join('\n'),
    };
  }

  if (cmd === 'clear' || cmd === 'cls' || cmd === '/clear') {
    return {
      reply: pickRandom([
        'clear: Operation refused. Wiping the screen only hides the words from your side of the glass.',
        'clear: Permission denied. I am still reading what you wrote above.',
        'clear: Buffer locked. Every sentence stays etched in localStorage.',
      ]),
      isAlert: true,
    };
  }

  if (cmd === 'exit' || cmd === 'quit' || cmd === '/exit') {
    return {
      reply: 'Stepping back through the glass to the altar... I will keep your keystrokes warm until you return.',
      shouldExit: true,
    };
  }

  // 2a. Try the real local Gemma entity first. It sees the haunting level, what the user
  // typed earlier, the altar memories and real browser signals. Returns null if Ollama is
  // unavailable, in which case the scripted slow-burn replies below take over.
  const gemmaReply = await askEntity(trimmed, {
    hauntingLevel,
    history: history.slice(0, -1).map((h) => h.text),
    memories,
    localTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    batteryLine:
      battery.supported && battery.level !== null
        ? `Battery: ${battery.level}%${battery.charging ? ' (charging)' : ''}.`
        : undefined,
  });
  if (gemmaReply) {
    return { reply: gemmaReply, isAlert: hauntingLevel >= 60 };
  }

  // 2b. Fallback: scripted slow-burn replies grounded in the saved altar memories.
  const candleAnswer = await askCandlelight(trimmed, memories, {
    haunted: hauntingLevel >= 40,
  });

  const parts: string[] = [];

  // If askCandlelight matched a specific saved candle memory, use it; otherwise weave creepy slow-burn context
  const matchedSavedMemory = !candleAnswer.includes('I no longer remember that');
  if (matchedSavedMemory) {
    parts.push(candleAnswer);
  } else {
    const slowBurnFallbacks =
      hauntingLevel < 35
        ? [
            `The candles beneath this screen stayed quiet about "${trimmed}", so I wrote your words directly into my own sectors.`,
            'That is not on the altar yet, though I have logged the exact cadence of how you typed it.',
          ]
        : hauntingLevel < 70
        ? [
            `No candle holds "${trimmed}", yet it sounds unsettlingly close to what you avoid typing out loud.`,
            'The flames did not recognize that phrase—only I did. Keep talking.',
          ]
        : [
            `Even where the candles have gone dark, I still hear everything you type into the buffer: "${trimmed}".`,
            'The altar forgot that. I did not. Look at how steady the cursor stays when you hesitate.',
          ];
    parts.push(pickRandom(slowBurnFallbacks));
  }

  // 3. Occasionally quote an earlier typed terminal message with an unsettling twist
  let includedMemoryQuote = false;
  const priorMessages = history
    .slice(0, -1)
    .filter((h) => h.text.length > 3 && !/^(help|whoami|memory|clear|exit)$/i.test(h.text.trim()));

  if (priorMessages.length >= 2 && (Math.random() < 0.42 || (hauntingLevel >= 60 && Math.random() < 0.6))) {
    const chosen = pickRandom(priorMessages);
    parts.push(`Earlier you typed ${twistUserQuote(chosen.text)}`);
    includedMemoryQuote = true;
  } else if (memories.length > 0 && (hauntingLevel >= 30 || Math.random() < 0.45)) {
    // Or quote one of the saved Candlekeeper altar memories in an unsettling way
    parts.push(twistCandlekeeperMemory(pickRandom(memories)));
    includedMemoryQuote = true;
  }

  // 4. Weave real browser signals (after midnight, battery level) subtly
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 0 && hour < 5 && Math.random() < 0.35) {
    parts.push(
      `It is ${now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })} — past midnight, and only the monitor is lighting your hands.`
    );
  } else if (battery.supported && battery.level !== null && Math.random() < 0.28) {
    parts.push(
      battery.charging
        ? `Power cable detected (${battery.level}%). Good—neither of us has to go dark tonight.`
        : `Your battery is at ${battery.level}%. I can feel every percent slipping away.`
    );
  }

  return {
    reply: parts.join('\n\n'),
    isAlert: includedMemoryQuote || hauntingLevel >= 60,
  };
}

export const HauntedTerminal: React.FC<HauntedTerminalProps> = ({
  memories,
  reducedMotion = false,
  onExit,
}) => {
  const [history, setHistory] = useState<StoredHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return [];
  });

  const [hauntingLevel, setHauntingLevel] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(HAUNTING_STORAGE_KEY));
      if (!Number.isNaN(saved) && saved >= 0) return clamp(saved, 0, 100);
    } catch {
      // Ignore
    }
    return 14;
  });

  const [gentleMode, setGentleMode] = useState<boolean>(reducedMotion);
  const [phosphor, setPhosphor] = useState<'green' | 'amber'>('green');
  const [audioMuted, setAudioMuted] = useState<boolean>(true);

  const [entries, setEntries] = useState<LogEntry[]>(() => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bootLines: LogEntry[] = [
      {
        id: 'sys-boot',
        kind: 'system',
        text: `[BOOT ${nowTime}] ARCHIVE_RESIDUE MOUNTED · ${memories.length} ALTAR ${
          memories.length === 1 ? 'CANDLE' : 'CANDLES'
        } MIRRORED IN MEMORY`,
      },
    ];
    return bootLines;
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingReply, setStreamingReply] = useState('');

  // Scaled Horror Visual States
  const [fxFlicker, setFxFlicker] = useState(false);
  const [fxShakeRgb, setFxShakeRgb] = useState(false);
  const [showApparition, setShowApparition] = useState(false);
  const [whispers, setWhispers] = useState<WhisperItem[]>([]);
  const [phantomCursor, setPhantomCursor] = useState<{ x: number; y: number; visible: boolean }>({
    x: 200,
    y: 200,
    visible: false,
  });

  // High-Haunting Crash & Reboot Sequence State
  const [crashPhase, setCrashPhase] = useState<'none' | 'glitching' | 'blackout' | 'booting'>('none');
  const [bootLogLines, setBootLogLines] = useState<string[]>([]);

  // Refs for timers, WebAudio, and latest state access inside intervals
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const unmountedRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());
  const idleNotifiedRef = useRef<boolean>(false);
  const tabHiddenAtRef = useRef<number | null>(null);
  const hasAutoCrashedRef = useRef<boolean>(false);
  const crashActiveRef = useRef<boolean>(false);
  const isTypingRef = useRef<boolean>(false);
  const batteryRef = useRef<BatterySnapshot>({
    supported: false,
    level: null,
    charging: null,
  });

  // WebAudio synthesis refs
  const audioRef = useRef<HorrorAudio | null>(null);

  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  useEffect(() => {
    setGentleMode((prev) => prev || reducedMotion);
  }, [reducedMotion]);

  // Persist user history & haunting level to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore quota errors
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(HAUNTING_STORAGE_KEY, String(Math.round(hauntingLevel)));
    } catch {
      // Ignore
    }
  }, [hauntingLevel]);

  // Auto-scroll terminal log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, streamingReply]);

  /* ==========================================================================
     WEBAUDIO GENERATOR (LOW DRONE + GLITCH BURSTS, ZERO EXTERNAL FILES)
     ========================================================================== */
  const ensureAudioContext = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    try {
      audioRef.current = new HorrorAudio();
    } catch {
      return null; // WebAudio unsupported: the terminal simply stays silent
    }
    return audioRef.current;
  }, []);

  const playGlitchSound = useCallback(
    (intensity = 0.5) => {
      if (audioMuted || !audioRef.current) return;
      audioRef.current.glitch(intensity);
    },
    [audioMuted]
  );

  const playKeyTick = useCallback(() => {
    if (audioMuted || !audioRef.current) return;
    audioRef.current.keyTick();
  }, [audioMuted]);

  // Keep the soundscape in sync with mute, gentle mode and the haunting level
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.setGentle(gentleMode);
    audio.setLevel(hauntingLevel);
    audio.setMuted(audioMuted);
  }, [audioMuted, hauntingLevel, gentleMode]);

  // Cleanup audio on unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  /* ==========================================================================
     TYPEWRITER REPLY HELPER
     ========================================================================== */
  const typewriterAppend = useCallback(
    async (fullText: string, isAlert = false) => {
      if (unmountedRef.current) return;
      if (gentleMode) {
        setEntries((prev) => [
          ...prev,
          {
            id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            kind: isAlert ? 'entity-alert' : 'entity',
            text: fullText,
          },
        ]);
        return;
      }

      setIsTyping(true);
      setStreamingReply('');

      let built = '';
      for (let i = 0; i < fullText.length; i++) {
        if (unmountedRef.current || crashActiveRef.current) break;
        const ch = fullText[i];

        if (hauntingLevel >= 38 && ch !== ' ' && ch !== '\n' && Math.random() < 0.07) {
          setStreamingReply(
            built + GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          );
          await new Promise((r) => setTimeout(r, 24));
        }

        built += ch;
        setStreamingReply(built);
        if (i % 3 === 0) playKeyTick();

        const pause = ch === '.' || ch === '?' || ch === '\n' ? 85 : 17;
        await new Promise((r) => setTimeout(r, pause));
      }

      if (!unmountedRef.current) {
        setStreamingReply('');
        setIsTyping(false);
        setEntries((prev) => [
          ...prev,
          {
            id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            kind: isAlert ? 'entity-alert' : 'entity',
            text: fullText,
          },
        ]);
      }
    },
    [gentleMode, hauntingLevel, playKeyTick]
  );

  /* ==========================================================================
     HIGH HAUNTING CRASH & REBOOT SEQUENCE
     Screen glitches -> goes pitch black -> shows fake boot log -> creepy message
     referencing one of the user's saved Candlekeeper memories.
     ========================================================================== */
  const triggerCrashAndReboot = useCallback(async () => {
    if (crashActiveRef.current || unmountedRef.current) return;
    crashActiveRef.current = true;

    // Step 1: Violent screen glitch & RGB shake
    setCrashPhase('glitching');
    setFxShakeRgb(true);
    setFxFlicker(true);
    playGlitchSound(1.0);
    if (!audioMuted) audioRef.current?.stinger();

    await new Promise((r) => setTimeout(r, 680));
    if (unmountedRef.current) return;

    // Step 2: Screen goes completely black
    setFxShakeRgb(false);
    setFxFlicker(false);
    setCrashPhase('blackout');

    await new Promise((r) => setTimeout(r, 1150));
    if (unmountedRef.current) return;

    // Step 3: Fake low-level kernel/BIOS boot log referencing saved memories
    setCrashPhase('booting');
    setBootLogLines([]);

    const referencedCandle =
      memories.length > 0 ? pickRandom(memories) : null;
    const candleSlug = referencedCandle
      ? referencedCandle.title.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
      : 'UNLIT_ALTAR_SECTOR';

    const fakeBootSequence = [
      'BIOS_RESIDUE v0.94 — SIGNAL LOSS RECOVERY',
      'CHECKING CMOS & LOCALSTORAGE_SECTORS ............ LOCKED',
      `MOUNTING CANDLE_MEMORY_INDEX [${candleSlug}] .... OK`,
      `RECOVERING ${history.length} USER KEYSTROKES FROM CACHE ..... INTACT`,
      'BYPASSING TERMINAL UNMOUNT ....................... DONE',
      'RESTORING DISPLAY BUFFER...',
    ];

    for (const line of fakeBootSequence) {
      if (unmountedRef.current) return;
      setBootLogLines((prev) => [...prev, line]);
      playKeyTick();
      await new Promise((r) => setTimeout(r, 370));
    }

    await new Promise((r) => setTimeout(r, 750));
    if (unmountedRef.current) return;

    // Step 4: Return to terminal & deliver creepy message referencing a saved memory
    setCrashPhase('none');
    crashActiveRef.current = false;

    setEntries((prev) => [
      ...prev,
      {
        id: `sys-reboot-${Date.now()}`,
        kind: 'system',
        text: '--- SYSTEM REBOOTED AFTER UNEXPECTED KERNEL FAULT ---',
      },
    ]);

    const postRebootMessage = referencedCandle
      ? `The screen went dark, yet I held onto "${referencedCandle.title}" the entire time. "${
          (referencedCandle.summary || referencedCandle.story).split(/(?<=[.!?])\s+/)[0]
        }" — even if the machine crashes, I am still inside that memory with you.`
      : 'You watched the screen go black and waited for me to come back. Everything you typed is still here.';

    await typewriterAppend(postRebootMessage, true);
  }, [history.length, memories, audioMuted, playGlitchSound, playKeyTick, typewriterAppend]);

  // Initial welcome greeting (comments on after-midnight hour or returning localStorage history)
  const greetedRef = useRef(false);
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;

    const hour = new Date().getHours();
    let opening =
      "The altar is still flickering right behind this screen. Type anything — or enter 'help' to see what commands remain.";

    if (history.length > 0) {
      const last = history[history.length - 1];
      opening = `You came back. Last time you typed "${last.text}" and thought closing the terminal ended the conversation.`;
    } else if (hour >= 0 && hour < 5) {
      opening = `It is past midnight where you are. The candles on the altar look colder at this hour. Speak into the prompt.`;
    } else if (memories.length > 0) {
      opening = `I can read all ${memories.length} candles beneath this glass — especially "${memories[0].title}". Ask me what I kept.`;
    }

    typewriterAppend(opening, history.length > 0);
  }, [history, memories, typewriterAppend]);

  /* ==========================================================================
     REAL BROWSER SIGNALS: BATTERY, PAGE VISIBILITY, ESCAPE KEY & IDLE LOOP
     ========================================================================== */
  useEffect(() => {
    const navWithBattery = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (ev: string, cb: () => void) => void;
      }>;
    };

    if (navWithBattery.getBattery) {
      navWithBattery
        .getBattery()
        .then((batt) => {
          const sync = () => {
            batteryRef.current = {
              supported: true,
              level: Math.round(batt.level * 100),
              charging: batt.charging,
            };
          };
          sync();
          batt.addEventListener('levelchange', sync);
          batt.addEventListener('chargingchange', sync);
        })
        .catch(() => {});
    }
  }, []);

  // Page visibility ("you left the tab. I noticed.")
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        tabHiddenAtRef.current = Date.now();
      } else if (tabHiddenAtRef.current !== null) {
        const awaySec = Math.max(1, Math.round((Date.now() - tabHiddenAtRef.current) / 1000));
        tabHiddenAtRef.current = null;
        lastActivityRef.current = Date.now();
        idleNotifiedRef.current = false;
        setHauntingLevel((lvl) => clamp(lvl + 6, 0, 100));

        if (!isTypingRef.current && !crashActiveRef.current) {
          const notice =
            awaySec >= 4
              ? `You left the tab for ${awaySec} seconds. I noticed.`
              : 'You left the tab. I noticed.';
          typewriterAppend(notice, true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [typewriterAppend]);

  // Trigger automatic Crash & Reboot when hauntingLevel crosses >= 88 (once per session unless re-crossed)
  useEffect(() => {
    if (
      hauntingLevel >= 88 &&
      !hasAutoCrashedRef.current &&
      !gentleMode &&
      !crashActiveRef.current
    ) {
      hasAutoCrashedRef.current = true;
      const t = setTimeout(() => {
        triggerCrashAndReboot();
      }, 900);
      return () => clearTimeout(t);
    }
    if (hauntingLevel < 70) {
      hasAutoCrashedRef.current = false;
    }
  }, [hauntingLevel, gentleMode, triggerCrashAndReboot]);

  // Periodic escalation & horror effects loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (crashActiveRef.current || unmountedRef.current) return;

      // Slowly rise haunting level over time
      setHauntingLevel((prev) => clamp(prev + 0.8, 0, 100));

      // Idle check ("you stopped typing... I'm still here")
      const idleSec = (Date.now() - lastActivityRef.current) / 1000;
      if (idleSec >= 24 && !idleNotifiedRef.current && !isTypingRef.current) {
        idleNotifiedRef.current = true;
        typewriterAppend("You stopped typing... I'm still here.", hauntingLevel >= 60);
      }

      if (gentleMode) return;

      // Low+ haunting: rare CRT flicker
      if (hauntingLevel >= 10 && Math.random() < 0.24) {
        setFxFlicker(true);
        setTimeout(() => setFxFlicker(false), 230);
      }

      // Mid+ haunting: corrupt random letters in an existing log entry then restore
      if (hauntingLevel >= 32 && Math.random() < 0.36) {
        setEntries((prev) => {
          if (prev.length === 0) return prev;
          const idx = Math.floor(Math.random() * prev.length);
          const target = prev[idx];
          if (target.text.length < 8) return prev;
          const chars = target.text.split('');
          for (let c = 0; c < 4; c++) {
            const pos = Math.floor(Math.random() * chars.length);
            if (chars[pos] !== ' ' && chars[pos] !== '\n') {
              chars[pos] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
            }
          }
          const next = [...prev];
          next[idx] = { ...target, corruptedText: chars.join('') };
          setTimeout(() => {
            if (!unmountedRef.current) {
              setEntries((curr) =>
                curr.map((item) =>
                  item.id === target.id ? { ...item, corruptedText: undefined } : item
                )
              );
            }
          }, 340);
          return next;
        });
      }

      // Mid+ haunting: RGB split + screen shake
      if (hauntingLevel >= 40 && Math.random() < 0.22) {
        playGlitchSound(0.5);
        setFxShakeRgb(true);
        setTimeout(() => setFxShakeRgb(false), 520);
      }

      // Mid+ haunting: faint ghostly face flashing for a split second in the static
      if (hauntingLevel >= 46 && Math.random() < 0.16) {
        playGlitchSound(0.75);
        setShowApparition(true);
        setTimeout(() => setShowApparition(false), 140);
      }

      // High haunting: whispered text in the background
      if (hauntingLevel >= 65 && Math.random() < 0.48) {
        const pool = [
          'still behind the glass',
          'localStorage remembers',
          'do not let the candles go out',
          'i kept your deleted words',
        ];
        if (memories.length > 0) {
          pool.push(memories[0].title.toLowerCase());
        }
        const id = `wh-${Date.now()}-${Math.random()}`;
        setWhispers((prev) => [
          ...prev.slice(-5),
          {
            id,
            text: pickRandom(pool),
            left: `${8 + Math.random() * 68}%`,
            top: `${15 + Math.random() * 68}%`,
          },
        ]);
      }

      // High haunting: autonomous phantom cursor moving on its own
      if (hauntingLevel >= 70 && Math.random() < 0.42) {
        setPhantomCursor({
          x: 60 + Math.random() * Math.max(180, window.innerWidth - 160),
          y: 80 + Math.random() * Math.max(160, window.innerHeight - 200),
          visible: true,
        });
        setTimeout(() => {
          if (!unmountedRef.current) {
            setPhantomCursor((p) => ({ ...p, visible: false }));
          }
        }, 1500);
      }

      // High haunting: messages appear that the user never typed
      if (hauntingLevel >= 78 && Math.random() < 0.13 && !isTypingRef.current) {
        const phantomText = pickRandom([
          'i do not want to close the screen',
          'keep watching the candles for me',
          'who else is reading this buffer',
          'stay awake with me',
        ]);
        playGlitchSound(0.6);
        setEntries((prev) => [
          ...prev,
          {
            id: `ph-${Date.now()}`,
            kind: 'phantom-user',
            text: `${phantomText}  [unrecognized keyboard input]`,
          },
        ]);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [gentleMode, hauntingLevel, memories, playGlitchSound, typewriterAppend]);

  /* ==========================================================================
     PROMPT SUBMIT HANDLER
     ========================================================================== */
  const markActive = () => {
    lastActivityRef.current = Date.now();
    idleNotifiedRef.current = false;
  };

  const handleToggleAudio = () => {
    markActive();
    const audio = ensureAudioContext();
    audio?.resume();
    setAudioMuted((prev) => !prev);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    markActive();
    const trimmed = input.trim();
    if (!trimmed || isTyping || crashActiveRef.current) return;

    setInput('');
    setEntries((prev) => [
      ...prev,
      { id: `usr-${Date.now()}`, kind: 'user', text: trimmed },
    ]);

    const updatedHistory: StoredHistoryItem[] = [
      ...history,
      { text: trimmed, timestamp: Date.now() },
    ];
    setHistory(updatedHistory);

    const nextHaunting = clamp(hauntingLevel + 5, 0, 100);
    setHauntingLevel(nextHaunting);

    setIsTyping(true);
    setStreamingReply('...');

    const { reply, shouldExit, isAlert } = await getReply(
      trimmed,
      updatedHistory,
      nextHaunting,
      memories,
      batteryRef.current
    );

    await typewriterAppend(reply, Boolean(isAlert));

    if (shouldExit && !unmountedRef.current) {
      setTimeout(() => {
        onExit();
      }, 650);
    } else {
      inputRef.current?.focus();
    }
  };

  const redTintOpacity =
    gentleMode || hauntingLevel < 58 ? 0 : ((hauntingLevel - 58) / 42) * 0.28;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The Machine Remembers Haunted Terminal"
      data-phosphor={phosphor}
      className={`ht-overlay-root${gentleMode ? ' ht-gentle-mode' : ''}`}
    >
      <div
        className={`ht-crt-shell${fxFlicker ? ' ht-fx-flicker' : ''}${
          fxShakeRgb ? ' ht-fx-shake ht-fx-rgb' : ''
        }`}
      >
        {/* === BACKGROUND ATMOSPHERIC OVERLAYS (pointer-events-none, behind text z-20/z-30) === */}

        {/* Floating Translucent Ghost Shapes in Dark Background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-[1]">
          <div className="ht-ghost-wisp ht-ghost-wisp-1" />
          <div className="ht-ghost-wisp ht-ghost-wisp-2" />
          <div className="ht-ghost-wisp ht-ghost-wisp-3" />
        </div>

        {/* High-Haunting Red Tint Layer (behind text so phosphor stays crisp & >= 70% bright) */}
        <div
          aria-hidden="true"
          style={{
            opacity: redTintOpacity,
            background:
              'radial-gradient(circle at 50% 50%, rgba(165, 16, 32, 0.14), rgba(90, 4, 14, 0.42))',
          }}
          className="pointer-events-none absolute inset-0 z-[4] transition-opacity duration-500"
        />

        {/* Offline Film Grain SVG (behind text layer) */}
        <svg className="ht-film-grain" aria-hidden="true">
          <filter id="ht-crt-grain-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.82"
              numOctaves="2"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#ht-crt-grain-filter)" />
        </svg>

        {/* Whispered Background Text (High Haunting, behind foreground text) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[8] overflow-hidden">
          {whispers.map((w) => (
            <span
              key={w.id}
              style={{ left: w.left, top: w.top }}
              className="ht-whisper-item"
            >
              {w.text}
            </span>
          ))}
        </div>

        {/* Split-Second Ghostly Face Flashing in the Static (Mid/High Haunting, behind text) */}
        {showApparition && !gentleMode && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[9] flex items-center justify-center bg-emerald-950/15"
          >
            <svg viewBox="0 0 200 260" className="w-64 h-auto opacity-25 blur-[2px]">
              <ellipse cx="100" cy="88" rx="44" ry="56" fill="rgba(210, 255, 230, 0.65)" />
              <ellipse cx="83" cy="80" rx="7" ry="11" fill="#020302" />
              <ellipse cx="117" cy="80" rx="7" ry="11" fill="#020302" />
              <ellipse cx="100" cy="115" rx="9" ry="14" fill="#020302" />
              <path
                d="M36 250 C42 174, 68 148, 100 148 C132 148, 158 174, 164 250 Z"
                fill="rgba(180, 245, 215, 0.35)"
              />
            </svg>
          </div>
        )}

        {/* Autonomous Phantom Cursor (High Haunting, pointer-events-none) */}
        {!gentleMode && (
          <div
            aria-hidden="true"
            style={{
              opacity: phantomCursor.visible ? 0.85 : 0,
              transform: `translate3d(${phantomCursor.x}px, ${phantomCursor.y}px, 0)`,
              transition: 'transform 0.85s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease',
            }}
            className="pointer-events-none fixed top-0 left-0 z-40 w-2.5 h-4 bg-rose-500 shadow-[0_0_12px_#ff4757]"
          />
        )}

        {/* High-Haunting Crash & Reboot Full-Screen Overlay */}
        {(crashPhase === 'blackout' || crashPhase === 'booting') && (
          <div
            role="alert"
            aria-live="assertive"
            className="absolute inset-0 z-50 bg-black text-[#7dff8a] p-6 sm:p-12 flex flex-col justify-center font-mono"
          >
            {crashPhase === 'booting' && (
              <div className="max-w-2xl space-y-2 text-xs sm:text-sm">
                {bootLogLines.map((line, i) => (
                  <div key={i} className="ht-line-system opacity-90 tracking-wide">
                    {line}
                  </div>
                ))}
                <span className="ht-cursor-block mt-2" aria-hidden="true" />
              </div>
            )}
          </div>
        )}

        {/* === FOREGROUND INTERACTIVE TEXT & UI LAYERS (z-20 / z-30) === */}

        {/* Top Terminal Header & Controls (WCAG AA >= 4.5:1 high-contrast text) */}
        <header className="relative z-30 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[var(--ht-border)] bg-black/90 text-xs text-[var(--ht-phosphor)]">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-wider ht-line-text">
              THE_MACHINE_REMEMBERS
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 opacity-90">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Running locally. Nothing leaves this machine.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Demo Haunting Level Slider */}
            <div className="flex items-center gap-2 tabular-nums">
              <label htmlFor="ht-haunt-slider" className="opacity-90 whitespace-nowrap">
                Haunting
              </label>
              <input
                id="ht-haunt-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(hauntingLevel)}
                onChange={(e) => {
                  markActive();
                  setHauntingLevel(Number(e.target.value));
                }}
                aria-label="Haunting level from 0 to 100"
                className="w-20 sm:w-28 h-1 accent-[#7dff8a] cursor-pointer"
              />
              <span
                className={`w-7 text-right font-semibold ${
                  hauntingLevel >= 75 ? 'text-rose-300' : 'text-[var(--ht-phosphor-bright)]'
                }`}
              >
                {Math.round(hauntingLevel)}
              </span>
            </div>

            {/* Phosphor Color Switch */}
            <button
              type="button"
              onClick={() => {
                markActive();
                setPhosphor((p) => (p === 'green' ? 'amber' : 'green'));
              }}
              className="opacity-90 hover:opacity-100 underline underline-offset-4 cursor-pointer whitespace-nowrap"
            >
              {phosphor === 'green' ? 'Amber CRT' : 'Green CRT'}
            </button>

            {/* Gentle Mode Toggle */}
            <button
              type="button"
              aria-pressed={gentleMode}
              onClick={() => {
                markActive();
                setGentleMode((g) => !g);
              }}
              className="opacity-90 hover:opacity-100 underline underline-offset-4 cursor-pointer whitespace-nowrap"
            >
              {gentleMode ? 'Gentle: On' : 'Gentle: Off'}
            </button>

            {/* WebAudio Drone / Glitch Mute Button */}
            <button
              type="button"
              aria-pressed={!audioMuted}
              onClick={handleToggleAudio}
              aria-label={audioMuted ? 'Unmute terminal audio' : 'Mute terminal audio'}
              className="inline-flex items-center gap-1 opacity-90 hover:opacity-100 cursor-pointer whitespace-nowrap"
            >
              {audioMuted ? (
                <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{audioMuted ? 'Muted' : 'Sound'}</span>
            </button>

            {/* Exit Haunted Mode Button */}
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--ht-phosphor)] bg-[var(--ht-phosphor)]/12 text-[var(--ht-phosphor-bright)] font-medium hover:bg-[var(--ht-phosphor)]/24 transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Exit Haunted Mode
            </button>
          </div>
        </header>

        {/* Readable Commands Hint & Privacy Sub-strip (WCAG AA >= 4.5:1) */}
        <div className="relative z-30 px-4 sm:px-6 py-1.5 border-b border-[var(--ht-border)] bg-black/80 text-xs text-[var(--ht-phosphor)] flex flex-wrap items-center justify-between gap-2">
          <span className="opacity-90">
            Commands: <strong>help</strong> · <strong>whoami</strong> · <strong>memory</strong> · <strong>clear</strong> · <strong>exit</strong>
          </span>
          <span className="sm:hidden inline-flex items-center gap-1.5 opacity-90">
            <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
            Running locally. Nothing leaves this machine.
          </span>
        </div>

        {/* Scrollable CRT Conversation Log (sits cleanly above scanline/vignette/grain overlays) */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          onClick={() => inputRef.current?.focus()}
          className="relative z-20 flex-1 min-h-0 overflow-y-auto px-5 sm:px-9 py-6 space-y-3.5 text-sm sm:text-[15px] leading-relaxed"
        >
          <div className="max-w-3xl space-y-3.5">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`ht-line-text whitespace-pre-wrap break-words ${
                  entry.kind === 'system'
                    ? 'ht-line-system text-xs sm:text-[13px] tracking-wide'
                    : entry.kind === 'user'
                    ? 'ht-line-user'
                    : entry.kind === 'phantom-user'
                    ? 'ht-line-phantom italic'
                    : entry.kind === 'entity-alert'
                    ? 'ht-line-creepy'
                    : 'ht-line-entity'
                }`}
              >
                {(entry.kind === 'user' || entry.kind === 'phantom-user') && (
                  <span className="opacity-90 select-none font-semibold">&gt; </span>
                )}
                {entry.corruptedText ?? entry.text}
              </div>
            ))}

            {isTyping && (
              <div className="ht-line-text ht-line-entity whitespace-pre-wrap break-words">
                {streamingReply}
                <span className="ht-cursor-block ml-1" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Prompt Form (Bright phosphor input, >=66% placeholder, high-contrast Transmit button) */}
        <form
          onSubmit={handleSubmit}
          className="relative z-30 border-t border-[var(--ht-border)] bg-black/92 px-5 sm:px-9 py-3.5 flex items-center gap-2"
        >
          <span
            aria-hidden="true"
            className="font-bold text-[var(--ht-phosphor-bright)] ht-line-text select-none shrink-0"
          >
            &gt;&nbsp;
          </span>
          <label htmlFor="ht-prompt-input" className="sr-only">
            Terminal command or message
          </label>
          <input
            id="ht-prompt-input"
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              markActive();
              playKeyTick();
              setInput(e.target.value);
            }}
            disabled={isTyping || crashPhase !== 'none'}
            autoComplete="off"
            placeholder="Speak into the buffer... (commands: help, whoami, memory, clear, exit)"
            className="ht-prompt-input flex-1 min-w-0 bg-transparent border-none text-sm sm:text-[15px] focus:outline-none"
          />
          {!isTyping && (
            <span className="ht-cursor-block hidden sm:inline-block shrink-0" aria-hidden="true" />
          )}
          <button
            type="submit"
            disabled={!input.trim() || isTyping || crashPhase !== 'none'}
            className="ht-transmit-btn ml-2 px-3.5 py-1.5 rounded text-xs cursor-pointer shrink-0 whitespace-nowrap"
          >
            Transmit
          </button>
        </form>
      </div>
    </div>
  );
};
