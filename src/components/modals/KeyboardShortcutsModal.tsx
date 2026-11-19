import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Keyboard,
  MousePointer2,
  Pencil,
  PenTool,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { TranslationKey } from '../../i18n/translations';
import {
  areBindingsEqual,
  bindingFromKeyboardEvent,
  DEFAULT_KEYBOARD_SHORTCUTS,
  findConflictingAction,
  formatShortcutParts,
  hasAnyCustomShortcut,
  isDefaultBinding,
  isMacPlatform,
  KeyboardShortcutMap,
  SHORTCUT_ACTION_ORDER,
  ShortcutActionId,
  ShortcutBinding,
} from '../../utils/keyboardShortcuts';

interface KeyboardShortcutsModalProps {
  shortcuts: KeyboardShortcutMap;
  onUpdateShortcuts: (next: KeyboardShortcutMap) => void;
  onResetAll: () => void;
  onClose: () => void;
}

interface ReferenceShortcutRow {
  id: string;
  labelKey: TranslationKey;
  descKey?: TranslationKey;
  combos: string[][];
}

const KeycapGroup: React.FC<{ parts: string[]; isModified?: boolean }> = ({
  parts,
  isModified = false,
}) => (
  <span className="inline-flex items-center gap-1 shrink-0">
    {parts.map((part, idx) => (
      <React.Fragment key={`${part}-${idx}`}>
        {idx > 0 && (
          <span className="text-[10px] text-[#757065] dark:text-neutral-500 font-medium">+</span>
        )}
        <kbd
          className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-md border text-[11px] font-mono font-semibold shadow-xs ${
            isModified
              ? 'bg-blue-600/15 border-blue-600/45 text-blue-800 dark:bg-blue-500/20 dark:border-blue-400/50 dark:text-blue-200'
              : 'bg-[#e8e4da] border-[#bdb7aa] text-[#2b2924] dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100'
          }`}
        >
          {part}
        </kbd>
      </React.Fragment>
    ))}
  </span>
);

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  shortcuts,
  onUpdateShortcuts,
  onResetAll,
  onClose,
}) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [recordingId, setRecordingId] = useState<ShortcutActionId | null>(null);
  const [conflictState, setConflictState] = useState<{
    targetId: ShortcutActionId;
    conflictId: ShortcutActionId;
    candidate: ShortcutBinding;
  } | null>(null);

  const mac = useMemo(() => isMacPlatform(), []);
  const anyCustomized = useMemo(() => hasAnyCustomShortcut(shortcuts), [shortcuts]);

  const actionMeta: Record<
    ShortcutActionId,
    { labelKey: TranslationKey; descKey: TranslationKey }
  > = useMemo(
    () => ({
      selectTool: { labelKey: 'shortcuts.action.selectTool', descKey: 'shortcuts.desc.selectTool' },
      panTool: { labelKey: 'shortcuts.action.panTool', descKey: 'shortcuts.desc.panTool' },
      holdPan: { labelKey: 'shortcuts.action.holdPan', descKey: 'shortcuts.desc.holdPan' },
      undo: { labelKey: 'shortcuts.action.undo', descKey: 'shortcuts.desc.undo' },
      redo: { labelKey: 'shortcuts.action.redo', descKey: 'shortcuts.desc.redo' },
      deleteSelected: {
        labelKey: 'shortcuts.action.deleteSelected',
        descKey: 'shortcuts.desc.deleteSelected',
      },
      clearSelection: {
        labelKey: 'shortcuts.action.clearSelection',
        descKey: 'shortcuts.desc.clearSelection',
      },
      focusSearch: { labelKey: 'shortcuts.action.focusSearch', descKey: 'shortcuts.desc.focusSearch' },
      openShortcuts: {
        labelKey: 'shortcuts.action.openShortcuts',
        descKey: 'shortcuts.desc.openShortcuts',
      },
    }),
    []
  );

  // Close with Escape when not recording; capture custom keystroke when recording
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (recordingId) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          setRecordingId(null);
          setConflictState(null);
          return;
        }

        const candidate = bindingFromKeyboardEvent(e);
        if (!candidate) return;

        const conflictId = findConflictingAction(shortcuts, candidate, recordingId);
        if (conflictId) {
          setConflictState({
            targetId: recordingId,
            conflictId,
            candidate,
          });
          setRecordingId(null);
          return;
        }

        onUpdateShortcuts({
          ...shortcuts,
          [recordingId]: candidate,
        });
        setRecordingId(null);
        setConflictState(null);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recordingId, shortcuts, onUpdateShortcuts, onClose]);

  const handleResetSingle = (id: ShortcutActionId) => {
    if (conflictState?.targetId === id || conflictState?.conflictId === id) {
      setConflictState(null);
    }
    onUpdateShortcuts({
      ...shortcuts,
      [id]: { ...DEFAULT_KEYBOARD_SHORTCUTS[id] },
    });
  };

  const handleSwapConflict = () => {
    if (!conflictState) return;
    const { targetId, conflictId, candidate } = conflictState;
    const prevTargetBinding = shortcuts[targetId];
    onUpdateShortcuts({
      ...shortcuts,
      [targetId]: candidate,
      [conflictId]: prevTargetBinding,
    });
    setConflictState(null);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesText = (parts: Array<string | undefined>): boolean => {
    if (!normalizedQuery) return true;
    return parts.some((p) => p && p.toLowerCase().includes(normalizedQuery));
  };

  const filteredCustomActions = useMemo(() => {
    return SHORTCUT_ACTION_ORDER.filter((id) => {
      const label = t(actionMeta[id].labelKey);
      const desc = t(actionMeta[id].descKey);
      const keyStr = formatShortcutParts(shortcuts[id], mac).join('+');
      const rawKey = shortcuts[id].code || shortcuts[id].key;
      return matchesText([label, desc, keyStr, rawKey]);
    });
  }, [actionMeta, mac, normalizedQuery, shortcuts, t]);

  const mouseReferenceRows: ReferenceShortcutRow[] = useMemo(
    () => [
      {
        id: 'multiSelect',
        labelKey: 'shortcuts.ref.multiSelect',
        descKey: 'shortcuts.ref.multiSelectDesc',
        combos: [[mac ? '⇧' : 'Shift', 'Click / Drag']],
      },
      {
        id: 'middlePan',
        labelKey: 'shortcuts.ref.middlePan',
        descKey: 'shortcuts.ref.middlePanDesc',
        combos: [['Middle Click', 'Drag']],
      },
      {
        id: 'wheelZoom',
        labelKey: 'shortcuts.ref.wheelZoom',
        descKey: 'shortcuts.ref.wheelZoomDesc',
        combos: [['Scroll Wheel']],
      },
      {
        id: 'doubleClick',
        labelKey: 'shortcuts.ref.doubleClick',
        descKey: 'shortcuts.ref.doubleClickDesc',
        combos: [['Double-Click']],
      },
      {
        id: 'altBend',
        labelKey: 'shortcuts.ref.altBend',
        descKey: 'shortcuts.ref.altBendDesc',
        combos: [[mac ? '⌥' : 'Alt', 'Drag']],
      },
    ],
    [mac]
  );

  const sketchReferenceRows: ReferenceShortcutRow[] = useMemo(
    () => [
      {
        id: 'sketchUndo',
        labelKey: 'shortcuts.ref.sketchUndo',
        combos: [[mac ? '⌘' : 'Ctrl', 'Z']],
      },
      {
        id: 'sketchRedo',
        labelKey: 'shortcuts.ref.sketchRedo',
        combos: [
          [mac ? '⌘' : 'Ctrl', 'Y'],
          [mac ? '⌘' : 'Ctrl', mac ? '⇧' : 'Shift', 'Z'],
        ],
      },
      {
        id: 'sketchPan',
        labelKey: 'shortcuts.ref.sketchPan',
        combos: [['Space']],
      },
      {
        id: 'sketchBrushSize',
        labelKey: 'shortcuts.ref.sketchBrushSize',
        combos: [['['], [']']],
      },
      {
        id: 'sketchEyedropper',
        labelKey: 'shortcuts.ref.sketchEyedropper',
        combos: [[mac ? '⌥' : 'Alt']],
      },
      {
        id: 'sketchLineSnap',
        labelKey: 'shortcuts.ref.sketchLineSnap',
        combos: [[mac ? '⇧' : 'Shift', 'Drag']],
      },
      {
        id: 'sketchTextCommit',
        labelKey: 'shortcuts.ref.sketchTextCommit',
        combos: [['Enter'], ['Esc']],
      },
    ],
    [mac]
  );

  const modalReferenceRows: ReferenceShortcutRow[] = useMemo(
    () => [
      {
        id: 'searchNav',
        labelKey: 'shortcuts.ref.searchNav',
        combos: [['↑'], ['↓']],
      },
      {
        id: 'searchJump',
        labelKey: 'shortcuts.ref.searchJump',
        combos: [['Enter']],
      },
      {
        id: 'aiGenerate',
        labelKey: 'shortcuts.ref.aiGenerate',
        combos: [[mac ? '⌘' : 'Ctrl', 'Enter']],
      },
      {
        id: 'inlineEdit',
        labelKey: 'shortcuts.ref.inlineEdit',
        combos: [['Enter'], ['Esc']],
      },
    ],
    [mac]
  );

  const filterRefRows = (rows: ReferenceShortcutRow[]) =>
    rows.filter((row) =>
      matchesText([
        t(row.labelKey),
        row.descKey ? t(row.descKey) : undefined,
        row.combos.map((c) => c.join('+')).join(' '),
      ])
    );

  const filteredMouseRows = useMemo(() => filterRefRows(mouseReferenceRows), [mouseReferenceRows, normalizedQuery, t]);
  const filteredSketchRows = useMemo(() => filterRefRows(sketchReferenceRows), [sketchReferenceRows, normalizedQuery, t]);
  const filteredModalRows = useMemo(() => filterRefRows(modalReferenceRows), [modalReferenceRows, normalizedQuery, t]);

  const totalVisible =
    filteredCustomActions.length +
    filteredMouseRows.length +
    filteredSketchRows.length +
    filteredModalRows.length;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 dark:bg-black/75 backdrop-blur-sm p-4"
      onClick={() => {
        if (recordingId) {
          setRecordingId(null);
        } else {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 shadow-2xl overflow-hidden text-[#2b2924] dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-start justify-between gap-3 shrink-0 bg-[#e4dfd3]/80 dark:bg-neutral-900">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 dark:bg-blue-500/20 border border-blue-600/30 dark:border-blue-500/35 flex items-center justify-center text-blue-700 dark:text-blue-400 shrink-0 mt-0.5">
              <Keyboard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">{t('shortcuts.title')}</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600/12 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-600/25 dark:border-blue-500/30">
                  {t('shortcuts.customizableBadge')}
                </span>
              </div>
              <p className="text-xs text-[#5c584e] dark:text-neutral-400 mt-0.5 leading-relaxed">
                {t('shortcuts.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#dcd7cc] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors shrink-0 cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Reset Toolbar */}
        <div className="px-5 py-3 border-b border-[#d4cfc3] dark:border-neutral-800 flex flex-wrap items-center gap-2.5 shrink-0 bg-[#e8e4da]/60 dark:bg-neutral-950/40">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#6e695d] dark:text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('shortcuts.searchPlaceholder')}
              className="w-full bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700 rounded-lg pl-9 pr-8 py-1.5 text-xs text-[#2b2924] dark:text-neutral-100 placeholder:text-[#757065] dark:placeholder:text-neutral-500 outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6e695d] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {anyCustomized && (
            <button
              type="button"
              onClick={() => {
                setRecordingId(null);
                setConflictState(null);
                onResetAll();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-xs font-semibold text-[#333029] dark:text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span>{t('shortcuts.resetAll')}</span>
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-6">
          {totalVisible === 0 ? (
            <div className="py-12 text-center text-xs text-[#6e695d] dark:text-neutral-500">
              {t('shortcuts.noResults', { query: searchQuery.trim() })}
            </div>
          ) : (
            <>
              {/* Customizable Canvas & Editing Hotkeys */}
              {filteredCustomActions.length > 0 && (
                <section className="space-y-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#5c584e] dark:text-neutral-400">
                    <Keyboard className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span>{t('shortcuts.sectionCanvas')}</span>
                  </div>

                  <div className="rounded-xl border border-[#c8c3b6] dark:border-neutral-800 bg-[#e4dfd3]/60 dark:bg-neutral-950/60 divide-y divide-[#d4cfc3] dark:divide-neutral-800/80 overflow-hidden">
                    {filteredCustomActions.map((actionId) => {
                      const binding = shortcuts[actionId];
                      const isModified = !isDefaultBinding(shortcuts, actionId);
                      const isRecording = recordingId === actionId;
                      const showRedoAlias =
                        actionId === 'redo' &&
                        areBindingsEqual(binding, DEFAULT_KEYBOARD_SHORTCUTS.redo);
                      const showDeleteAlias =
                        actionId === 'deleteSelected' &&
                        areBindingsEqual(binding, DEFAULT_KEYBOARD_SHORTCUTS.deleteSelected);
                      const hasConflictHere = conflictState?.targetId === actionId;

                      return (
                        <div key={actionId} className="px-3.5 py-2.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-[#2b2924] dark:text-neutral-100">
                                  {t(actionMeta[actionId].labelKey)}
                                </span>
                                {isModified && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-600/15 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-600/25 dark:border-blue-500/30">
                                    {t('shortcuts.modifiedBadge')}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#635e54] dark:text-neutral-400 mt-0.5">
                                {t(actionMeta[actionId].descKey)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isRecording ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2.5 py-1 rounded-lg bg-blue-600/15 dark:bg-blue-500/20 border border-blue-600/50 dark:border-blue-400/60 text-[11px] font-semibold text-blue-800 dark:text-blue-200 animate-pulse">
                                    {t('shortcuts.recordingPrompt')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setRecordingId(null)}
                                    className="px-2 py-1 rounded-md bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[11px] font-medium text-[#433f37] dark:text-neutral-300 cursor-pointer"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConflictState(null);
                                      setRecordingId(actionId);
                                    }}
                                    title={t('shortcuts.clickToEditTitle')}
                                    className="group inline-flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-[#dad4c7] dark:hover:bg-neutral-800/90 transition-colors cursor-pointer"
                                  >
                                    <KeycapGroup
                                      parts={formatShortcutParts(binding, mac)}
                                      isModified={isModified}
                                    />
                                    {showRedoAlias && (
                                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[#6e695d] dark:text-neutral-500">
                                        <span>{t('shortcuts.altAliasAlso')}</span>
                                        <KeycapGroup
                                          parts={[mac ? '⌘' : 'Ctrl', mac ? '⇧' : 'Shift', 'Z']}
                                        />
                                      </span>
                                    )}
                                    {showDeleteAlias && (
                                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[#6e695d] dark:text-neutral-500">
                                        <span>{t('shortcuts.altAliasAlso')}</span>
                                        <KeycapGroup parts={['Backspace']} />
                                      </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#6e695d] group-hover:text-blue-700 dark:text-neutral-500 dark:group-hover:text-blue-400 pl-1">
                                      <Pencil className="w-3 h-3" />
                                      <span className="hidden sm:inline">
                                        {t('shortcuts.clickToEdit')}
                                      </span>
                                    </span>
                                  </button>

                                  {isModified && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetSingle(actionId)}
                                      title={t('shortcuts.resetOneTitle')}
                                      className="p-1.5 rounded-lg text-[#5c584e] hover:text-amber-800 hover:bg-[#dad4c7] dark:text-neutral-400 dark:hover:text-amber-300 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {hasConflictHere && conflictState && (
                            <div className="p-2.5 rounded-lg bg-amber-600/12 dark:bg-amber-950/40 border border-amber-600/35 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-900 dark:text-amber-200">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                                <span>
                                  {t('shortcuts.conflictWarning', {
                                    action: t(actionMeta[conflictState.conflictId].labelKey),
                                  })}
                                </span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleSwapConflict}
                                  className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors cursor-pointer"
                                >
                                  {t('shortcuts.swapBtn')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConflictState(null)}
                                  className="px-2 py-1 rounded-md bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#333029] dark:text-neutral-200 font-medium cursor-pointer"
                                >
                                  {t('common.cancel')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Mouse & Canvas Modifiers */}
              {filteredMouseRows.length > 0 && (
                <section className="space-y-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#5c584e] dark:text-neutral-400">
                    <MousePointer2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>{t('shortcuts.sectionMouse')}</span>
                  </div>

                  <div className="rounded-xl border border-[#c8c3b6] dark:border-neutral-800 bg-[#e4dfd3]/60 dark:bg-neutral-950/60 divide-y divide-[#d4cfc3] dark:divide-neutral-800/80 overflow-hidden">
                    {filteredMouseRows.map((row) => (
                      <div
                        key={row.id}
                        className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[#2b2924] dark:text-neutral-100">
                            {t(row.labelKey)}
                          </div>
                          {row.descKey && (
                            <p className="text-[11px] text-[#635e54] dark:text-neutral-400 mt-0.5">
                              {t(row.descKey)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {row.combos.map((parts, idx) => (
                            <KeycapGroup key={idx} parts={parts} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Sketch Studio & Quick Search / Modal Shortcuts */}
              {(filteredSketchRows.length > 0 || filteredModalRows.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSketchRows.length > 0 && (
                    <section className="space-y-2.5">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#5c584e] dark:text-neutral-400">
                        <PenTool className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
                        <span>{t('shortcuts.sectionSketch')}</span>
                      </div>
                      <div className="rounded-xl border border-[#c8c3b6] dark:border-neutral-800 bg-[#e4dfd3]/60 dark:bg-neutral-950/60 divide-y divide-[#d4cfc3] dark:divide-neutral-800/80 overflow-hidden">
                        {filteredSketchRows.map((row) => (
                          <div
                            key={row.id}
                            className="px-3.5 py-2 flex items-center justify-between gap-2.5"
                          >
                            <span className="text-xs font-medium text-[#2b2924] dark:text-neutral-200">
                              {t(row.labelKey)}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {row.combos.map((parts, idx) => (
                                <React.Fragment key={idx}>
                                  {idx > 0 && (
                                    <span className="text-[10px] text-[#757065] dark:text-neutral-500">
                                      /
                                    </span>
                                  )}
                                  <KeycapGroup parts={parts} />
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {filteredModalRows.length > 0 && (
                    <section className="space-y-2.5">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#5c584e] dark:text-neutral-400">
                        <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                        <span>{t('shortcuts.sectionModals')}</span>
                      </div>
                      <div className="rounded-xl border border-[#c8c3b6] dark:border-neutral-800 bg-[#e4dfd3]/60 dark:bg-neutral-950/60 divide-y divide-[#d4cfc3] dark:divide-neutral-800/80 overflow-hidden">
                        {filteredModalRows.map((row) => (
                          <div
                            key={row.id}
                            className="px-3.5 py-2 flex items-center justify-between gap-2.5"
                          >
                            <span className="text-xs font-medium text-[#2b2924] dark:text-neutral-200">
                              {t(row.labelKey)}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {row.combos.map((parts, idx) => (
                                <React.Fragment key={idx}>
                                  {idx > 0 && (
                                    <span className="text-[10px] text-[#757065] dark:text-neutral-500">
                                      /
                                    </span>
                                  )}
                                  <KeycapGroup parts={parts} />
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0 bg-[#e4dfd3]/80 dark:bg-neutral-900 text-[11px] text-[#5c584e] dark:text-neutral-400">
          <span>{t('shortcuts.footerTip')}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-[#c3beb1] dark:border-neutral-700 text-xs font-semibold text-[#2b2924] dark:text-neutral-100 transition-colors cursor-pointer shrink-0"
          >
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
