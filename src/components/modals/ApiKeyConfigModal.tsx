import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { GeminiApiKeyEntry } from '../../services/firestoreService';

interface ApiKeyConfigModalProps {
  userName: string;
  userEmail: string;
  apiKeys: GeminiApiKeyEntry[];
  activeKeyId: string | null;
  onSaveConfig: (keys: GeminiApiKeyEntry[], activeKeyId: string | null) => Promise<void>;
  onClose: () => void;
}

const MAX_SAVED_KEYS = 20;

function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 10) return '••••••••••••';
  return `${trimmed.slice(0, 6)}••••••••••••${trimmed.slice(-4)}`;
}

function createKeyEntryId(): string {
  return `key-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const ApiKeyConfigModal: React.FC<ApiKeyConfigModalProps> = ({
  userName,
  userEmail,
  apiKeys,
  activeKeyId,
  onSaveConfig,
  onClose,
}) => {
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(apiKeys.length === 0);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [showNewKeyText, setShowNewKeyText] = useState(false);
  const [activateOnSave, setActivateOnSave] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editKey, setEditKey] = useState('');
  const [showEditKeyText, setShowEditKeyText] = useState(false);

  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (apiKeys.length === 0) {
      setIsAdding(true);
    }
  }, [apiKeys.length]);

  const activeEntry = activeKeyId
    ? apiKeys.find((entry) => entry.id === activeKeyId) ?? null
    : null;

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKeys.length >= MAX_SAVED_KEYS) {
      setError(t('apiKey.errLimit'));
      return;
    }
    const trimmedKey = newKey.trim();
    if (trimmedKey.length < 10 || trimmedKey.length > 256) {
      setError(t('apiKey.errLength'));
      return;
    }

    const now = new Date().toISOString();
    const resolvedLabel =
      newLabel.trim().slice(0, 60) || `API Key ${apiKeys.length + 1}`;

    const entry: GeminiApiKeyEntry = {
      id: createKeyEntryId(),
      label: resolvedLabel,
      apiKey: trimmedKey,
      createdAt: now,
      updatedAt: now,
    };

    const nextKeys = [...apiKeys, entry];
    const nextActiveId = activateOnSave ? entry.id : activeKeyId;

    setError(null);
    setIsSaving(true);
    try {
      await onSaveConfig(nextKeys, nextActiveId);
      setNewLabel('');
      setNewKey('');
      setShowNewKeyText(false);
      setActivateOnSave(true);
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKey.errSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (targetId: string) => {
    if (isSaving) return;
    const nextActiveId = activeKeyId === targetId ? null : targetId;
    setError(null);
    setIsSaving(true);
    try {
      await onSaveConfig(apiKeys, nextActiveId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKey.errSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (entry: GeminiApiKeyEntry) => {
    setConfirmDeleteId(null);
    setIsAdding(false);
    setEditingId(entry.id);
    setEditLabel(entry.label);
    setEditKey(entry.apiKey);
    setShowEditKeyText(false);
    setError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const trimmedKey = editKey.trim();
    if (trimmedKey.length < 10 || trimmedKey.length > 256) {
      setError(t('apiKey.errLength'));
      return;
    }

    const now = new Date().toISOString();
    const nextKeys = apiKeys.map((entry, idx) =>
      entry.id === editingId
        ? {
            ...entry,
            label: editLabel.trim().slice(0, 60) || `API Key ${idx + 1}`,
            apiKey: trimmedKey,
            updatedAt: now,
          }
        : entry
    );

    setError(null);
    setIsSaving(true);
    try {
      await onSaveConfig(nextKeys, activeKeyId);
      setEditingId(null);
      setEditLabel('');
      setEditKey('');
      setShowEditKeyText(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKey.errSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKey = async (targetId: string) => {
    setError(null);
    setIsSaving(true);
    try {
      const nextKeys = apiKeys.filter((entry) => entry.id !== targetId);
      const nextActiveId = activeKeyId === targetId ? null : activeKeyId;
      await onSaveConfig(nextKeys, nextActiveId);
      setConfirmDeleteId(null);
      if (editingId === targetId) {
        setEditingId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKey.errDelete'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#d4cfc3] dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600/15 dark:bg-blue-600/20 border border-blue-600/30 dark:border-blue-500/30 flex items-center justify-center text-blue-700 dark:text-blue-400 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#2b2924] dark:text-neutral-100 truncate">
                {t('apiKey.title')}
              </h3>
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
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <p className="text-xs text-[#433f37] dark:text-neutral-300 leading-relaxed">
              {t('apiKey.introBeforeCreate')}
              <span className="font-semibold text-[#1f1d18] dark:text-white">
                {t('apiKey.introCreate')}
              </span>
              {t('apiKey.introBetween')}
              <span className="font-semibold text-[#1f1d18] dark:text-white">
                {t('apiKey.introEdit')}
              </span>
              {t('apiKey.introAfterEdit')}
            </p>

            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800 text-[11px]">
              <span className="text-[#5c584e] dark:text-neutral-400">
                {t('apiKey.singleActiveHint')}
              </span>
              <span
                className={`font-semibold shrink-0 ${
                  activeEntry
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {activeEntry
                  ? t('apiKey.activeCountOne', { total: apiKeys.length })
                  : t('apiKey.activeCountNone')}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-600/15 dark:bg-red-950/60 border border-red-600/35 dark:border-red-700/60 text-xs text-red-800 dark:text-red-200 break-words">
              {error}
            </div>
          )}

          {/* Saved API Keys List */}
          {apiKeys.length > 0 && (
            <div className="space-y-2.5">
              {apiKeys.map((entry) => {
                const isActive = entry.id === activeKeyId;
                const isRevealed = Boolean(revealedIds[entry.id]);
                const isEditingThis = editingId === entry.id;
                const isConfirmingDelete = confirmDeleteId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                      isActive
                        ? 'bg-[#e0dbd0] dark:bg-neutral-950 border-emerald-700/45 dark:border-emerald-500/45 shadow-sm'
                        : 'bg-[#e5e0d5] dark:bg-neutral-950/70 border-[#c8c3b6] dark:border-neutral-800'
                    }`}
                  >
                    {/* Card Header: Label + Active Toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                            isActive
                              ? 'bg-emerald-600/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-600/30 dark:border-emerald-500/30'
                              : 'bg-[#d4cfc3] text-[#5c584e] dark:bg-neutral-800 dark:text-neutral-400 border border-[#c3beb1] dark:border-neutral-700'
                          }`}
                        >
                          {isActive && <Check className="w-3 h-3" />}
                          <span>{isActive ? t('apiKey.statusActive') : t('apiKey.statusInactive')}</span>
                        </span>
                        <span className="text-xs font-bold text-[#2b2924] dark:text-neutral-100 truncate">
                          {entry.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isActive}
                          disabled={isSaving}
                          onClick={() => handleToggleActive(entry.id)}
                          title={isActive ? t('apiKey.deactivate') : t('apiKey.activate')}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                            isActive
                              ? 'bg-emerald-600 dark:bg-emerald-500'
                              : 'bg-[#bdb7aa] dark:bg-neutral-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleToggleActive(entry.id)}
                          className={`text-[11px] font-semibold cursor-pointer disabled:opacity-50 ${
                            isActive
                              ? 'text-emerald-800 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200'
                              : 'text-[#433f37] hover:text-[#1f1d18] dark:text-neutral-300 dark:hover:text-white'
                          }`}
                        >
                          {isActive ? t('apiKey.deactivate') : t('apiKey.activate')}
                        </button>
                      </div>
                    </div>

                    {isEditingThis ? (
                      <form onSubmit={handleSaveEdit} className="space-y-2.5 pt-1">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-semibold text-[#433f37] dark:text-neutral-300 uppercase tracking-wider">
                            {t('apiKey.labelField')}
                          </label>
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            maxLength={60}
                            placeholder={t('apiKey.labelPlaceholder')}
                            className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 focus:border-blue-500 rounded-lg px-2.5 py-2 text-xs text-[#2b2924] dark:text-neutral-100 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-semibold text-[#433f37] dark:text-neutral-300 uppercase tracking-wider">
                            {t('apiKey.newKeyLabel')}
                          </label>
                          <div className="relative">
                            <input
                              type={showEditKeyText ? 'text' : 'password'}
                              value={editKey}
                              onChange={(e) => setEditKey(e.target.value)}
                              placeholder="AIza..."
                              autoComplete="off"
                              autoFocus
                              className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 focus:border-blue-500 rounded-lg pl-2.5 pr-8 py-2 text-xs font-mono text-[#2b2924] dark:text-neutral-100 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowEditKeyText((prev) => !prev)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
                              title={showEditKeyText ? t('apiKey.hideKey') : t('apiKey.showKey')}
                            >
                              {showEditKeyText ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              setEditingId(null);
                              setEditLabel('');
                              setEditKey('');
                              setError(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#3a362e] dark:text-neutral-300 text-xs font-medium cursor-pointer"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            type="submit"
                            disabled={isSaving || !editKey.trim()}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                          >
                            {isSaving ? t('common.saving') : t('apiKey.updateKey')}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {/* Masked Key Box + Reveal */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[#ebe7de] dark:bg-neutral-900 border border-[#c8c3b6] dark:border-neutral-800 font-mono text-xs text-[#2b2924] dark:text-neutral-200 break-all">
                            {isRevealed ? entry.apiKey : maskApiKey(entry.apiKey)}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedIds((prev) => ({
                                ...prev,
                                [entry.id]: !prev[entry.id],
                              }))
                            }
                            className="px-2 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[11px] text-[#433f37] hover:text-[#1f1d18] dark:text-neutral-300 dark:hover:text-white flex items-center gap-1 shrink-0 cursor-pointer"
                            title={isRevealed ? t('apiKey.hide') : t('apiKey.reveal')}
                          >
                            {isRevealed ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            <span>{isRevealed ? t('apiKey.hide') : t('apiKey.reveal')}</span>
                          </button>
                        </div>

                        {/* Delete Confirm or Change/Delete Row */}
                        {isConfirmingDelete ? (
                          <div className="p-2.5 rounded-lg bg-red-600/10 dark:bg-red-950/40 border border-red-600/35 dark:border-red-500/40 space-y-2">
                            <p className="text-xs text-red-800 dark:text-red-200 font-medium">
                              {t('apiKey.confirmDeleteText')}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleDeleteKey(entry.id)}
                                className="flex-1 py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                              >
                                {isSaving ? t('apiKey.deleting') : t('apiKey.confirmDelete')}
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => setConfirmDeleteId(null)}
                                className="py-1.5 px-3 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#3a362e] dark:text-neutral-300 text-xs transition-colors cursor-pointer"
                              >
                                {t('common.cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleStartEdit(entry)}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-[#2b2924] dark:text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                              <span>{t('apiKey.changeKey')}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                setEditingId(null);
                                setConfirmDeleteId(entry.id);
                              }}
                              className="py-1.5 px-3 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-600/30 dark:border-red-500/30 text-red-700 dark:text-red-300 dark:hover:text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t('common.delete')}</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add New API Key Button or Form */}
          {!isAdding ? (
            <button
              type="button"
              disabled={isSaving || apiKeys.length >= MAX_SAVED_KEYS}
              onClick={() => {
                setEditingId(null);
                setConfirmDeleteId(null);
                setError(null);
                setIsAdding(true);
              }}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-blue-600/45 dark:border-blue-500/45 bg-blue-600/10 hover:bg-blue-600/15 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 disabled:opacity-50 text-blue-800 dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('apiKey.addAnotherKey')}</span>
            </button>
          ) : (
            <form
              onSubmit={handleAddKey}
              className="p-3.5 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 space-y-3"
            >
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#433f37] dark:text-neutral-300 uppercase tracking-wider">
                  {t('apiKey.labelField')}
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  maxLength={60}
                  placeholder={t('apiKey.labelPlaceholder')}
                  className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 outline-none placeholder:text-[#757065] dark:placeholder:text-neutral-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#433f37] dark:text-neutral-300 uppercase tracking-wider">
                  {t('apiKey.keyLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showNewKeyText ? 'text' : 'password'}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="AIza..."
                    autoComplete="off"
                    autoFocus
                    className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 focus:border-blue-500 rounded-xl pl-3 pr-9 py-2.5 text-xs font-mono text-[#2b2924] dark:text-neutral-100 outline-none placeholder:text-[#757065] dark:placeholder:text-neutral-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewKeyText((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
                    title={showNewKeyText ? t('apiKey.hideKey') : t('apiKey.showKey')}
                  >
                    {showNewKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#3a362e] dark:text-neutral-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={activateOnSave}
                  onChange={(e) => setActivateOnSave(e.target.checked)}
                  className="rounded border-[#c3beb1] dark:border-neutral-700 text-blue-600 focus:ring-blue-500"
                />
                <span>{t('apiKey.activateOnSave')}</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                {apiKeys.length > 0 && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setIsAdding(false);
                      setNewLabel('');
                      setNewKey('');
                      setError(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#3a362e] dark:text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving || !newKey.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  {isSaving ? t('common.saving') : t('apiKey.saveKey')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
