import React, { useState, useEffect, useMemo } from 'react';
import { useReducedMotion } from 'motion/react';
import { Flame, ShieldCheck, Download } from 'lucide-react';
import { ChatMessage, Memory, OfrendaProfile, OllamaSettings } from './types';
import { DEFAULT_PROFILE, createSeedMemories } from './data/seedMemories';
import {
  extractMemory,
  askCandlelight,
  describePhoto,
  loadOllamaSettings,
  saveOllamaSettings,
} from './services/ai';
import {
  computeMemoryStrength,
  getDaysSinceRecall,
  MS_PER_DAY,
} from './utils/memoryMath';
import { exportOfrendaHtml } from './utils/exportOfrenda';
import { PapelPicadoBanner } from './components/PapelPicadoBanner';
import { GhostLayer } from './components/GhostLayer';
import { Altar } from './components/Altar';
import { TimeSlider } from './components/TimeSlider';
import { MemoryModal } from './components/MemoryModal';
import { MemoryDrawer } from './components/MemoryDrawer';
import { ChatPanel } from './components/ChatPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { CreditsModal } from './components/CreditsModal';
import { HauntedOverlay } from './components/HauntedOverlay';
import { HauntedTerminal } from './components/HauntedTerminal';
import { createPortal } from 'react-dom';

const MEMORIES_STORAGE_KEY = 'candlekeeper_memories_v1';
const PROFILE_STORAGE_KEY = 'candlekeeper_profile_v1';

export default function App() {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const [profile, setProfile] = useState<OfrendaProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) return { ...DEFAULT_PROFILE, ...JSON.parse(saved) };
    } catch {
      // Fallback to default profile
    }
    return DEFAULT_PROFILE;
  });

  const [memories, setMemories] = useState<Memory[]>(() => {
    try {
      const saved = localStorage.getItem(MEMORIES_STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to seed memories
    }
    return createSeedMemories(Date.now());
  });

  const [ollamaSettings, setOllamaSettings] = useState<OllamaSettings>(() =>
    loadOllamaSettings()
  );

  // Demo Time Travel offset (0 to 60 days)
  const [timeTravelDays, setTimeTravelDays] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);

  // Ghost / Rekindle ephemeral triggers
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [rekindledId, setRekindledId] = useState<string | null>(null);

  // Ask the Candlelight chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hauntedMode, setHauntedMode] = useState(false);

  // Persist memories & profile to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(memories));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [memories]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [profile]);

  // Subtle minute ticker so decay stays fresh in long sessions
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Compute current strengths for all memories
  const strengthsById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of memories) {
      map[m.id] = computeMemoryStrength(m, nowTick, timeTravelDays);
    }
    return map;
  }, [memories, nowTick, timeTravelDays]);

  const selectedMemory = useMemo(
    () => memories.find((m) => m.id === selectedMemoryId) ?? null,
    [memories, selectedMemoryId]
  );

  const handleUpdateProfile = (updates: Partial<OfrendaProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const handleSelectMemory = (memory: Memory) => {
    setSelectedMemoryId(memory.id);
  };

  const triggerRekindleAnimation = (memoryId: string) => {
    setRekindledId(memoryId);
    setTimeout(() => {
      setRekindledId((curr) => (curr === memoryId ? null : curr));
    }, 1500);
  };

  const handleRememberAgain = (memoryId: string) => {
    const effectiveNow = Date.now() + timeTravelDays * MS_PER_DAY;
    setNowTick(Date.now());
    setMemories((prev) =>
      prev.map((m) =>
        m.id === memoryId ? { ...m, lastRecalledAt: effectiveNow } : m
      )
    );
    triggerRekindleAnimation(memoryId);
  };

  const handleAppendNote = (memoryId: string, additionalNote: string) => {
    const effectiveNow = Date.now() + timeTravelDays * MS_PER_DAY;
    setNowTick(Date.now());
    setMemories((prev) =>
      prev.map((m) =>
        m.id === memoryId
          ? {
              ...m,
              story: `${m.story}\n\n${additionalNote}`,
              lastRecalledAt: effectiveNow,
            }
          : m
      )
    );
    triggerRekindleAnimation(memoryId);
  };

  const handleDeleteMemory = (memoryId: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    if (selectedMemoryId === memoryId) {
      setSelectedMemoryId(null);
    }
  };

  const handleAddMemorySubmit = async (story: string, photoBase64?: string) => {
    const [{ title, summary, tags }, photoDescription] = await Promise.all([
      extractMemory(story),
      photoBase64 ? describePhoto(photoBase64) : Promise.resolve(undefined),
    ]);

    const now = Date.now();
    const effectiveNow = now + timeTravelDays * MS_PER_DAY;
    const tierOptions: Array<1 | 2 | 3> = [2, 3, 1, 2, 3];
    const nextTier = tierOptions[memories.length % tierOptions.length];

    const newMemory: Memory = {
      id: `mem-${now}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      story,
      summary,
      tags,
      photoBase64,
      photoDescription,
      createdAt: now,
      lastRecalledAt: effectiveNow,
      tier: nextTier,
    };

    setNowTick(now);
    setMemories((prev) => [...prev, newMemory]);
    setNewlyAddedId(newMemory.id);
    setTimeout(() => {
      setNewlyAddedId((curr) => (curr === newMemory.id ? null : curr));
    }, 3800);
  };

  const handleSendQuestion = async (question: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsAsking(true);

    try {
      const adjustedMemories = memories.map((m) => ({
        ...m,
        lastRecalledAt: m.lastRecalledAt - timeTravelDays * MS_PER_DAY,
      }));
      const answer = await askCandlelight(question, adjustedMemories, {
        haunted: hauntedMode,
        honoree: profile.honoreeName,
      });

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-c`,
        role: 'candlelight',
        content: answer,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleExportOfrenda = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportOfrendaHtml(profile, memories, timeTravelDays);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveSettings = (next: OllamaSettings) => {
    saveOllamaSettings(next);
    setOllamaSettings(next);
  };

  const handleResetDemo = () => {
    const fresh = createSeedMemories(Date.now());
    setMemories(fresh);
    setProfile(DEFAULT_PROFILE);
    setTimeTravelDays(0);
    setChatMessages([]);
    setSelectedMemoryId(null);
  };

  return (
    <div
      className={`relative min-h-screen flex flex-col text-[#f5f0e6] pb-16 lg:pb-0${
        hauntedMode ? ' haunted-mode' : ''
      }`}
    >
      {/* Ambient Midnight Sanctuary, tsParticles Layer & Framer Motion Wisps */}
      <GhostLayer reducedMotion={prefersReducedMotion} />
      <HauntedOverlay enabled={hauntedMode} reducedMotion={prefersReducedMotion} />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="relative z-30 flex items-center justify-between gap-2 sm:gap-8 px-3 sm:px-8 py-3.5 border-b border-[#f5f0e6]/10 bg-[#0b0a1a]/75 backdrop-blur-md">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#ofrenda-main"
          className="font-serif text-xl sm:text-2xl font-semibold tracking-wide text-[#f5f0e6] whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c] rounded"
        >
          Candlekeeper
        </a>

        {/* Zone 2: Concise single-line navigation links + Haunted Mode toggle */}
        <nav
          aria-label="Primary actions"
          className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-normal text-[#f5f0e6]/75"
        >
          <a
            href="#ofrenda-main"
            className="hidden md:inline hover:text-[#ffbf69] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Ofrenda
          </a>
          <a
            href="#time-travel-section"
            className="hidden md:inline hover:text-[#ffbf69] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Time Travel
          </a>
          <button
            type="button"
            onClick={handleExportOfrenda}
            disabled={isExporting}
            className="hidden md:inline hover:text-[#ffbf69] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExporting ? 'Exporting...' : 'Export Ofrenda'}
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="hidden md:inline hover:text-[#ffbf69] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => setIsCreditsOpen(true)}
            className="hidden lg:inline hover:text-[#ffbf69] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Credits
          </button>
          <button
            type="button"
            onClick={() => setHauntedMode((prev) => !prev)}
            aria-pressed={hauntedMode}
            className={`px-2.5 py-1 rounded border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              hauntedMode
                ? 'border-teal-300/60 bg-teal-400/15 text-teal-200'
                : 'border-[#f5f0e6]/20 text-[#f5f0e6]/75 hover:text-[#ffbf69] hover:border-[#ffbf69]/40'
            }`}
          >
            {hauntedMode ? 'Haunted Mode: On' : 'Haunted Mode'}
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action ("Add a Memory" with candle flame icon) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            aria-label="Add a Memory"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg bg-[#ff9f1c] text-[#0b0a1a] text-xs sm:text-sm font-semibold hover:bg-[#ffbf69] transition-colors shadow-[0_0_20px_rgba(255,159,28,0.28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf69] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Flame className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Add a Memory</span>
            <span className="sm:hidden" aria-hidden="true">Add</span>
          </button>
        </div>
      </header>

      {/* Decorative Papel Picado Banner Gently Swaying Across Top */}
      <PapelPicadoBanner reducedMotion={prefersReducedMotion} />

      {/* Main Content Layout: Altar on Left/Center + Chat Side Panel on Desktop */}
      <main
        id="ofrenda-main"
        className="relative z-10 flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-6 flex flex-col lg:flex-row items-start gap-8"
      >
        {/* Left / Center Sanctuary Column */}
        <div className="flex-1 w-full min-w-0 flex flex-col items-center">
          {/* Local Privacy Status Strip + Mobile Utility Actions */}
          <div className="w-full max-w-3xl flex flex-wrap items-center justify-between gap-3 mb-3 px-1 text-xs text-[#f5f0e6]/65">
            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#ffbf69] shrink-0" aria-hidden="true" />
              <span>Running locally. Your memories never leave this device.</span>
            </div>

            {/* Mobile-accessible Export, Settings & Credits controls */}
            <div className="flex md:hidden items-center gap-3.5 text-xs text-[#f5f0e6]/75">
              <button
                type="button"
                onClick={handleExportOfrenda}
                disabled={isExporting}
                className="inline-flex items-center gap-1 hover:text-[#ffbf69] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="hover:text-[#ffbf69] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => setIsCreditsOpen(true)}
                className="hover:text-[#ffbf69] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Credits
              </button>
            </div>
          </div>

          {/* 3-Tiered Altar */}
          <Altar
            profile={profile}
            memories={memories}
            strengthsById={strengthsById}
            selectedMemoryId={selectedMemoryId}
            newlyAddedId={newlyAddedId}
            rekindledId={rekindledId}
            reducedMotion={prefersReducedMotion}
            onSelectMemory={handleSelectMemory}
            onUpdateProfile={handleUpdateProfile}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />

          {/* Subtle Altar Instruction Hint */}
          {memories.length > 0 && (
            <p className="text-xs text-[#f5f0e6]/50 text-center mb-5">
              Select any candle to read its story and restore its flame · Hover portrait to upload a photograph
            </p>
          )}

          {/* Time Travel Demo Slider (0 to 60 days) */}
          <div id="time-travel-section" className="w-full mt-1">
            <TimeSlider
              daysOffset={timeTravelDays}
              onChangeDays={setTimeTravelDays}
            />
          </div>
        </div>

        {/* Ask the Candlelight Side Panel (Desktop) & Bottom Sheet (Mobile) */}
        <ChatPanel
          messages={chatMessages}
          memories={memories}
          strengthsById={strengthsById}
          isAsking={isAsking}
          onSendQuestion={handleSendQuestion}
        />
      </main>

      {/* Quiet Sanctuary Footer with Credits Trigger */}
      <footer className="relative z-10 w-full max-w-[1380px] mx-auto px-4 sm:px-8 py-4 border-t border-[#f5f0e6]/10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#f5f0e6]/50">
        <span>
          Candlekeeper · 100% offline-capable virtual Día de los Muertos ofrenda
        </span>
        <div className="flex items-center gap-3">
          <span>Bundled locally with tsParticles, Lottie &amp; Motion</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setIsCreditsOpen(true)}
            className="text-[#ffbf69]/85 hover:text-[#ffbf69] underline underline-offset-4 cursor-pointer whitespace-nowrap"
          >
            View Credits &amp; Licenses
          </button>
        </div>
      </footer>

      {/* Add a Memory Modal */}
      <MemoryModal
        isOpen={isAddModalOpen}
        honoreeName={profile.honoreeName}
        reducedMotion={prefersReducedMotion}
        onClose={() => setIsAddModalOpen(false)}
        onSubmitStory={handleAddMemorySubmit}
      />

      {/* Memory Detail & Flame Restoration Drawer */}
      <MemoryDrawer
        memory={selectedMemory}
        strength={selectedMemory ? strengthsById[selectedMemory.id] ?? 0 : 0}
        daysSinceRecall={
          selectedMemory
            ? getDaysSinceRecall(selectedMemory, nowTick, timeTravelDays)
            : 0
        }
        reducedMotion={prefersReducedMotion}
        onClose={() => setSelectedMemoryId(null)}
        onRememberAgain={handleRememberAgain}
        onAppendNote={handleAppendNote}
        onDeleteMemory={handleDeleteMemory}
      />

      {/* Local Ollama Settings Modal */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        settings={ollamaSettings}
        reducedMotion={prefersReducedMotion}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSettings={handleSaveSettings}
        onResetSampleOfrenda={handleResetDemo}
      />

      {/* Credits & Open-Source Attribution Modal */}
      <CreditsModal
        isOpen={isCreditsOpen}
        reducedMotion={prefersReducedMotion}
        onClose={() => setIsCreditsOpen(false)}
      />

      {/* Full-Screen Haunted Terminal Overlay (Altar underneath stays mounted and intact) */}
      {/* Rendered through a portal on <body>: the page wrapper has a CSS filter in Haunted Mode,
          which would otherwise make this fixed overlay as tall as the whole page. */}
      {hauntedMode &&
        createPortal(
          <HauntedTerminal
            memories={memories.map((m) => ({
              ...m,
              lastRecalledAt: m.lastRecalledAt - timeTravelDays * MS_PER_DAY,
            }))}
            reducedMotion={prefersReducedMotion}
            onExit={() => setHauntedMode(false)}
          />,
          document.body
        )}
    </div>
  );
}
