import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Pencil, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface ApiKeyConfigModalProps {
  userName: string;
  userEmail: string;
  currentApiKey: string | null;
  onSaveKey: (apiKey: string) => Promise<void>;
  onDeleteKey: () => Promise<void>;
  onClose: () => void;
}

function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 10) return '••••••••••••';
  return `${trimmed.slice(0, 6)}••••••••••••${trimmed.slice(-4)}`;
}

export const ApiKeyConfigModal: React.FC<ApiKeyConfigModalProps> = ({
  userName,
  userEmail,
  currentApiKey,
  onSaveKey,
  onDeleteKey,
  onClose,
}) => {
  const { t } = useLanguage();
  const hasSavedKey = Boolean(currentApiKey && currentApiKey.trim());
  const [isEditing, setIsEditing] = useState(!hasSavedKey);
  const [inputKey, setInputKey] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [showSavedKey, setShowSavedKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSavedKey) {
      setIsEditing(true);
    }
  }, [hasSavedKey]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (trimmed.length < 10 || trimmed.length > 256) {
      setError(t('apiKey.errLength'));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSaveKey(trimmed);
      setInputKey('');
      setShowKeyText(false);
      setIsEditing(false);
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKey.errSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await onDeleteKey();
      setConfirmDelete(false);
      setInputKey('');
      setIsEditing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKey.errDelete'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#d4cfc3] dark:border-neutral-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600/15 dark:bg-blue-600/20 border border-blue-600/30 dark:border-blue-500/30 flex items-center justify-center text-blue-700 dark:text-blue-400 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#2b2924] dark:text-neutral-100 truncate">{t('apiKey.title')}</h3>
              <p className="text-[11px] text-[#5c584e] dark:text-neutral-400 truncate">
                {userName} · {userEmail || t('apiKey.personalAccount')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-xs text-[#433f37] dark:text-neutral-300 leading-relaxed">
            {t('apiKey.introBeforeCreate')}
            <span className="font-semibold text-[#1f1d18] dark:text-white">{t('apiKey.introCreate')}</span>
            {t('apiKey.introBetween')}
            <span className="font-semibold text-[#1f1d18] dark:text-white">{t('apiKey.introEdit')}</span>
            {t('apiKey.introAfterEdit')}
          </p>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-600/15 dark:bg-red-950/60 border border-red-600/35 dark:border-red-700/60 text-xs text-red-800 dark:text-red-200 break-words">
              {error}
            </div>
          )}

          {hasSavedKey && !isEditing && currentApiKey && (
            <div className="p-3.5 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 border border-emerald-700/30 dark:border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('apiKey.savedTitle')}</span>
                </span>

                <button
                  type="button"
                  onClick={() => setShowSavedKey((prev) => !prev)}
                  className="text-[11px] text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                >
                  {showSavedKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showSavedKey ? t('apiKey.hide') : t('apiKey.reveal')}</span>
                </button>
              </div>

              <div className="px-3 py-2 rounded-lg bg-[#ebe7de] dark:bg-neutral-900 border border-[#c8c3b6] dark:border-neutral-800 font-mono text-xs text-[#2b2924] dark:text-neutral-200 break-all">
                {showSavedKey ? currentApiKey : maskApiKey(currentApiKey)}
              </div>

              {confirmDelete ? (
                <div className="p-2.5 rounded-lg bg-red-600/10 dark:bg-red-950/40 border border-red-600/35 dark:border-red-500/40 space-y-2">
                  <p className="text-xs text-red-800 dark:text-red-200 font-medium">
                    {t('apiKey.confirmDeleteText')}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleDelete}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isSaving ? t('apiKey.deleting') : t('apiKey.confirmDelete')}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setConfirmDelete(false)}
                      className="py-1.5 px-3 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#3a362e] dark:text-neutral-300 text-xs transition-colors cursor-pointer"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setInputKey('');
                      setError(null);
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-[#2b2924] dark:text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span>{t('apiKey.changeKey')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="py-2 px-3 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-600/30 dark:border-red-500/30 text-red-700 dark:text-red-300 dark:hover:text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('common.delete')}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {isEditing && (
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#433f37] dark:text-neutral-300 uppercase tracking-wider">
                  {hasSavedKey ? t('apiKey.newKeyLabel') : t('apiKey.keyLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showKeyText ? 'text' : 'password'}
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="AIza..."
                    autoComplete="off"
                    autoFocus
                    className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 focus:border-blue-500 rounded-xl pl-3 pr-9 py-2.5 text-xs font-mono text-[#2b2924] dark:text-neutral-100 outline-none placeholder:text-[#757065] dark:placeholder:text-neutral-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
                    title={showKeyText ? t('apiKey.hideKey') : t('apiKey.showKey')}
                  >
                    {showKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {hasSavedKey && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setIsEditing(false);
                      setInputKey('');
                      setError(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#3a362e] dark:text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving || !inputKey.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  {isSaving
                    ? t('common.saving')
                    : hasSavedKey
                    ? t('apiKey.updateKey')
                    : t('apiKey.saveKey')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
