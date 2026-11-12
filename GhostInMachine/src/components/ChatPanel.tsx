import React, { useState, useRef, useEffect } from 'react';
import { Flame, Send, ChevronUp, ChevronDown } from 'lucide-react';
import { ChatMessage, Memory } from '../types';
import { AiSource, getAiSource, subscribeAiSource } from '../services/ai';

interface ChatPanelProps {
  messages: ChatMessage[];
  memories: Memory[];
  strengthsById: Record<string, number>;
  isAsking: boolean;
  onSendQuestion: (question: string) => Promise<void>;
}

const SUGGESTED_QUESTIONS = [
  'What did she do before dawn in the kitchen?',
  'What happened when afternoon rain rolled in?',
  'Tell me about the marigold seeds in November.',
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  memories,
  strengthsById,
  isAsking,
  onSendQuestion,
}) => {
  const [input, setInput] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [aiSource, setAiSource] = useState<AiSource>(getAiSource());

  useEffect(() => subscribeAiSource(setAiSource), []);

  const vividCount = memories.filter((m) => (strengthsById[m.id] ?? 0) >= 0.3).length;

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isAsking, mobileOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isAsking) return;
    setInput('');
    await onSendQuestion(trimmed);
  };

  const renderChatBody = () => (
    <div className="flex flex-col h-full">
      {/* Header + Mandatory Ethical Note */}
      <div className="px-5 pt-4 pb-3.5 border-b border-[#f5f0e6]/10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-medium text-[#f5f0e6] flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#ff9f1c]" aria-hidden="true" />
            Ask the Candlelight
          </h2>
          <span className="flex items-center gap-2 text-xs text-[#f5f0e6]/50 tabular-nums">
            {aiSource !== 'unknown' && (
              <span
                title={
                  aiSource === 'gemma'
                    ? 'Answers are coming from your local Gemma model via Ollama'
                    : 'Ollama was not reachable, so offline demo replies are being used'
                }
                className={`px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide ${
                  aiSource === 'gemma'
                    ? 'border-[#7dff8a]/40 text-[#7dff8a]'
                    : 'border-[#ffbf69]/40 text-[#ffbf69]'
                }`}
              >
                {aiSource === 'gemma' ? 'Gemma live' : 'Demo mode'}
              </span>
            )}
            {vividCount}/{memories.length} vivid
          </span>
        </div>

        {/* Visible ethical disclaimer */}
        <p className="mt-2 text-xs italic text-[#ffbf69]/90 bg-[#ff9f1c]/[0.07] border border-[#ff9f1c]/20 rounded-md px-3 py-2 leading-relaxed">
          This is not them. It is only what you remember.
        </p>
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollContainerRef}
        aria-live="polite"
        className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[220px]"
      >
        {messages.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-xs text-[#f5f0e6]/60 leading-relaxed">
              Ask about a habit, recipe, song, or season kept on the altar. If a candle has dimmed below recall, the candlelight will tell you it no longer remembers.
            </p>
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] text-[#f5f0e6]/45">Try asking:</p>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSendQuestion(q)}
                  disabled={isAsking}
                  className="block w-full text-left text-xs text-[#f5f0e6]/80 hover:text-[#ffbf69] bg-[#0b0a1a]/65 hover:bg-[#ff9f1c]/10 border border-[#f5f0e6]/10 rounded-lg px-3 py-2 transition-colors cursor-pointer"
                >
                  “{q}”
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <span className="text-[10px] text-[#f5f0e6]/40 mb-1 px-1">
                {msg.role === 'user' ? 'You' : 'Candlelight'}
              </span>
              <div
                className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#261f47] text-[#f5f0e6] border border-[#f5f0e6]/12'
                    : 'bg-[#0b0a1a]/90 text-[#f5f0e6]/95 border border-[#ff9f1c]/25 font-serif text-[15px]'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {isAsking && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-[#f5f0e6]/40 mb-1 px-1">Candlelight</span>
            <div className="rounded-xl px-3.5 py-2.5 bg-[#0b0a1a]/90 border border-[#ff9f1c]/20 text-xs italic text-[#ffbf69]/80">
              Listening to the flames...
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3.5 border-t border-[#f5f0e6]/10 bg-[#0d0b1d]"
      >
        <div className="flex items-center gap-2">
          <label htmlFor="ask-candlelight-input" className="sr-only">
            Ask a question about saved memories
          </label>
          <input
            id="ask-candlelight-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask what the candles still hold..."
            disabled={isAsking}
            className="flex-1 min-w-0 rounded-lg bg-[#16132d] border border-[#f5f0e6]/15 px-3.5 py-2.5 text-xs sm:text-sm text-[#f5f0e6] placeholder:text-[#f5f0e6]/35 focus:outline-none focus:border-[#ff9f1c]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isAsking}
            aria-label="Send question to the candlelight"
            className="p-2.5 rounded-lg bg-[#ff9f1c] text-[#0b0a1a] hover:bg-[#ffbf69] disabled:opacity-40 disabled:hover:bg-[#ff9f1c] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbf69] shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {/* Desktop Side Panel */}
      <aside
        aria-label="Ask the Candlelight memory chat"
        className="hidden lg:flex lg:w-[370px] xl:w-[400px] shrink-0 flex-col rounded-xl bg-[#121026]/90 border border-[#f5f0e6]/12 backdrop-blur-md shadow-[0_16px_48px_rgba(0,0,0,0.65)] h-[calc(100vh-8.5rem)] sticky top-20 overflow-hidden"
      >
        {renderChatBody()}
      </aside>

      {/* Mobile Bottom Sheet (<= 15% sticky height when collapsed!) */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40">
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-[1px] -z-10"
          />
        )}

        <div
          className={`bg-[#121026] border-t border-[#ff9f1c]/30 shadow-[0_-12px_36px_rgba(0,0,0,0.85)] transition-all duration-200 ${
            mobileOpen ? 'h-[72vh] rounded-t-2xl flex flex-col' : 'h-12'
          }`}
        >
          {/* Sheet Handle / Toggle Bar */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-candlelight-sheet"
            className="w-full h-12 px-4 flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f1c] shrink-0 cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 font-serif text-base text-[#f5f0e6]">
              <Flame className="w-4 h-4 text-[#ff9f1c]" />
              Ask the Candlelight
              <span className="font-sans text-[11px] text-[#f5f0e6]/50">
                · Only what you remember
              </span>
            </span>
            {mobileOpen ? (
              <ChevronDown className="w-4 h-4 text-[#f5f0e6]/70" />
            ) : (
              <ChevronUp className="w-4 h-4 text-[#f5f0e6]/70" />
            )}
          </button>

          {mobileOpen && (
            <div id="mobile-candlelight-sheet" className="flex-1 min-h-0 overflow-hidden">
              {renderChatBody()}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
