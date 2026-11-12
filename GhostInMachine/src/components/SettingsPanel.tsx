import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, Check, Plug } from 'lucide-react';
import { OllamaSettings } from '../types';
import { DEFAULT_OLLAMA_SETTINGS, checkOllama, OllamaCheckResult } from '../services/ai';

interface SettingsPanelProps {
  isOpen: boolean;
  settings: OllamaSettings;
  reducedMotion: boolean;
  onClose: () => void;
  onSaveSettings: (next: OllamaSettings) => void;
  onResetSampleOfrenda: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  settings,
  reducedMotion,
  onClose,
  onSaveSettings,
  onResetSampleOfrenda,
}) => {
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl);
  const [modelName, setModelName] = useState(settings.modelName);
  const [savedNotice, setSavedNotice] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<OllamaCheckResult | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await checkOllama({
      ollamaUrl: ollamaUrl.trim() || DEFAULT_OLLAMA_SETTINGS.ollamaUrl,
      modelName: modelName.trim() || DEFAULT_OLLAMA_SETTINGS.modelName,
    });
    setTestResult(result);
    setTesting(false);
  };

  useEffect(() => {
    if (isOpen) {
      setOllamaUrl(settings.ollamaUrl);
      setModelName(settings.modelName);
      setSavedNotice(false);
      setTestResult(null);
    }
  }, [isOpen, settings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ollamaUrl: ollamaUrl.trim() || DEFAULT_OLLAMA_SETTINGS.ollamaUrl,
      modelName: modelName.trim() || DEFAULT_OLLAMA_SETTINGS.modelName,
    });
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 650);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="relative z-10 w-full max-w-md rounded-xl bg-[#121026] border border-[#f5f0e6]/15 shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-6 text-[#f5f0e6]"
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#f5f0e6]/10">
              <div>
                <h2
                  id="settings-modal-title"
                  className="font-serif text-2xl font-medium text-[#f5f0e6]"
                >
                  Local Sanctuary Settings
                </h2>
                <p className="text-xs text-[#f5f0e6]/60 mt-0.5">
                  Configure your local Ollama endpoint and manage stored memories.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="p-1.5 rounded-lg text-[#f5f0e6]/55 hover:text-[#f5f0e6] hover:bg-[#f5f0e6]/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="ollama-url-input"
                  className="block text-xs font-medium text-[#f5f0e6]/85 mb-1.5"
                >
                  Local Ollama Chat Endpoint URL
                </label>
                <input
                  id="ollama-url-input"
                  type="url"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434/api/chat"
                  className="w-full rounded-lg bg-[#0b0a1a] border border-[#f5f0e6]/15 px-3.5 py-2 text-xs sm:text-sm text-[#f5f0e6] focus:outline-none focus:border-[#ff9f1c]"
                />
              </div>

              <div>
                <label
                  htmlFor="ollama-model-input"
                  className="block text-xs font-medium text-[#f5f0e6]/85 mb-1.5"
                >
                  Model Name
                </label>
                <input
                  id="ollama-model-input"
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="gemma3"
                  className="w-full rounded-lg bg-[#0b0a1a] border border-[#f5f0e6]/15 px-3.5 py-2 text-xs sm:text-sm text-[#f5f0e6] focus:outline-none focus:border-[#ff9f1c]"
                />
                <p className="mt-1.5 text-[11px] text-[#f5f0e6]/50 leading-relaxed">
                  Candlekeeper talks to your local Gemma through Ollama. If Ollama is not running, it falls back to an offline demo mode automatically.
                </p>
                <div className="mt-3 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={runTest}
                    disabled={testing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f5f0e6]/20 text-xs text-[#f5f0e6]/85 hover:border-[#ff9f1c]/50 hover:text-[#ffbf69] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <Plug className="w-3.5 h-3.5" />
                    {testing ? 'Testing...' : 'Test connection'}
                  </button>
                  {testResult && (
                    <p
                      role="status"
                      className={`text-[11px] leading-relaxed ${
                        testResult.ok && testResult.modelInstalled ? 'text-[#7dff8a]' : 'text-[#ffbf69]'
                      }`}
                    >
                      {testResult.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#f5f0e6]/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOllamaUrl(DEFAULT_OLLAMA_SETTINGS.ollamaUrl);
                    setModelName(DEFAULT_OLLAMA_SETTINGS.modelName);
                  }}
                  className="text-xs text-[#f5f0e6]/60 hover:text-[#f5f0e6] underline underline-offset-4 cursor-pointer"
                >
                  Restore defaults
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff9f1c] text-[#0b0a1a] text-xs font-semibold hover:bg-[#ffbf69] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  {savedNotice ? 'Saved' : 'Save Settings'}
                </button>
              </div>
            </form>

            {/* Sample Data Reset Utility */}
            <div className="mt-6 pt-4 border-t border-[#f5f0e6]/10 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#f5f0e6]/85">Sample Ofrenda</p>
                <p className="text-[11px] text-[#f5f0e6]/50">
                  Restore the 3 initial sample candles and portrait.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onResetSampleOfrenda();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f5f0e6]/20 text-xs text-[#f5f0e6]/80 hover:border-[#ff9f1c]/50 hover:text-[#ffbf69] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Demo
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
