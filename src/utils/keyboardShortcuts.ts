export type ShortcutActionId =
  | 'undo'
  | 'redo'
  | 'selectTool'
  | 'panTool'
  | 'holdPan'
  | 'deleteSelected'
  | 'clearSelection'
  | 'focusSearch'
  | 'openShortcuts';

export interface ShortcutBinding {
  key: string;
  code?: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type KeyboardShortcutMap = Record<ShortcutActionId, ShortcutBinding>;

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutMap = {
  undo: { key: 'z', mod: true },
  redo: { key: 'y', mod: true },
  selectTool: { key: 'v' },
  panTool: { key: 'h' },
  holdPan: { key: ' ', code: 'Space' },
  deleteSelected: { key: 'Delete' },
  clearSelection: { key: 'Escape' },
  focusSearch: { key: 'k', mod: true },
  openShortcuts: { key: '?' },
};

export const SHORTCUT_ACTION_ORDER: ShortcutActionId[] = [
  'selectTool',
  'panTool',
  'holdPan',
  'undo',
  'redo',
  'deleteSelected',
  'clearSelection',
  'focusSearch',
  'openShortcuts',
];

const STORAGE_KEY_PREFIX = 'vwc-keyboard-shortcuts';
const MODIFIER_ONLY_KEYS = new Set([
  'Shift',
  'Control',
  'Meta',
  'Alt',
  'AltGraph',
  'CapsLock',
  'NumLock',
  'ScrollLock',
]);

const SHIFT_PRODUCED_SYMBOLS = new Set([
  '?',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ')',
  '_',
  '+',
  '{',
  '}',
  '|',
  ':',
  '"',
  '<',
  '>',
  '~',
]);

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
}

function getStorageKey(uid?: string | null): string {
  const cleanUid = typeof uid === 'string' && uid.trim() ? uid.trim() : '';
  return cleanUid ? `${STORAGE_KEY_PREFIX}:${cleanUid}` : STORAGE_KEY_PREFIX;
}

function normalizeBinding(raw: unknown): ShortcutBinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.key !== 'string' || obj.key.length === 0 || obj.key.length > 32) {
    return null;
  }
  const binding: ShortcutBinding = {
    key: obj.key.length === 1 ? (obj.key === ' ' ? ' ' : obj.key.toLowerCase()) : obj.key,
  };
  if (typeof obj.code === 'string' && obj.code.length > 0 && obj.code.length <= 32) {
    binding.code = obj.code;
  }
  if (obj.mod === true) binding.mod = true;
  if (obj.shift === true) binding.shift = true;
  if (obj.alt === true) binding.alt = true;
  return binding;
}

export function loadKeyboardShortcuts(uid?: string | null): KeyboardShortcutMap {
  const defaults: KeyboardShortcutMap = {
    undo: { ...DEFAULT_KEYBOARD_SHORTCUTS.undo },
    redo: { ...DEFAULT_KEYBOARD_SHORTCUTS.redo },
    selectTool: { ...DEFAULT_KEYBOARD_SHORTCUTS.selectTool },
    panTool: { ...DEFAULT_KEYBOARD_SHORTCUTS.panTool },
    holdPan: { ...DEFAULT_KEYBOARD_SHORTCUTS.holdPan },
    deleteSelected: { ...DEFAULT_KEYBOARD_SHORTCUTS.deleteSelected },
    clearSelection: { ...DEFAULT_KEYBOARD_SHORTCUTS.clearSelection },
    focusSearch: { ...DEFAULT_KEYBOARD_SHORTCUTS.focusSearch },
    openShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS.openShortcuts },
  };

  if (typeof window === 'undefined') return defaults;

  try {
    const raw =
      window.localStorage.getItem(getStorageKey(uid)) ??
      window.localStorage.getItem(STORAGE_KEY_PREFIX);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return defaults;

    for (const actionId of SHORTCUT_ACTION_ORDER) {
      const normalized = normalizeBinding(parsed[actionId]);
      if (normalized) {
        defaults[actionId] = normalized;
      }
    }
  } catch {
    // Ignore corrupt localStorage payload
  }
  return defaults;
}

export function saveKeyboardShortcuts(map: KeyboardShortcutMap, uid?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify(map);
    window.localStorage.setItem(getStorageKey(uid), payload);
    if (uid) {
      window.localStorage.setItem(STORAGE_KEY_PREFIX, payload);
    }
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export function areBindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  const normKeyA = a.code === 'Space' || a.key === ' ' ? 'Space' : a.key.toLowerCase();
  const normKeyB = b.code === 'Space' || b.key === ' ' ? 'Space' : b.key.toLowerCase();
  return (
    normKeyA === normKeyB &&
    Boolean(a.mod) === Boolean(b.mod) &&
    Boolean(a.shift) === Boolean(b.shift) &&
    Boolean(a.alt) === Boolean(b.alt)
  );
}

export function hasAnyCustomShortcut(map: KeyboardShortcutMap): boolean {
  return SHORTCUT_ACTION_ORDER.some(
    (id) => !areBindingsEqual(map[id], DEFAULT_KEYBOARD_SHORTCUTS[id])
  );
}

export function isDefaultBinding(map: KeyboardShortcutMap, actionId: ShortcutActionId): boolean {
  return areBindingsEqual(map[actionId], DEFAULT_KEYBOARD_SHORTCUTS[actionId]);
}

export function bindingFromKeyboardEvent(
  e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>
): ShortcutBinding | null {
  if (MODIFIER_ONLY_KEYS.has(e.key)) return null;

  const mod = Boolean(e.ctrlKey || e.metaKey);
  const alt = Boolean(e.altKey);
  const isSymbolWithImplicitShift =
    !mod && !alt && e.key.length === 1 && SHIFT_PRODUCED_SYMBOLS.has(e.key);
  const shift = isSymbolWithImplicitShift ? false : Boolean(e.shiftKey);

  if (e.code === 'Space' || e.key === ' ') {
    return {
      key: ' ',
      code: 'Space',
      ...(mod ? { mod: true } : {}),
      ...(shift ? { shift: true } : {}),
      ...(alt ? { alt: true } : {}),
    };
  }

  const normalizedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return {
    key: normalizedKey,
    ...(mod ? { mod: true } : {}),
    ...(shift ? { shift: true } : {}),
    ...(alt ? { alt: true } : {}),
  };
}

export function matchesShortcut(
  e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
  binding: ShortcutBinding
): boolean {
  const hasMod = Boolean(e.ctrlKey || e.metaKey);
  const hasAlt = Boolean(e.altKey);
  if (hasMod !== Boolean(binding.mod)) return false;
  if (hasAlt !== Boolean(binding.alt)) return false;

  if (binding.code === 'Space' || binding.key === ' ') {
    if (Boolean(e.shiftKey) !== Boolean(binding.shift)) return false;
    return e.code === 'Space' || e.key === ' ';
  }

  const isSymbolWithImplicitShift =
    !binding.mod && !binding.alt && !binding.shift && binding.key.length === 1 && SHIFT_PRODUCED_SYMBOLS.has(binding.key);

  if (!isSymbolWithImplicitShift && Boolean(e.shiftKey) !== Boolean(binding.shift)) {
    return false;
  }

  return e.key.toLowerCase() === binding.key.toLowerCase();
}

export function findConflictingAction(
  map: KeyboardShortcutMap,
  candidate: ShortcutBinding,
  excludeActionId: ShortcutActionId
): ShortcutActionId | null {
  for (const id of SHORTCUT_ACTION_ORDER) {
    if (id === excludeActionId) continue;
    if (areBindingsEqual(map[id], candidate)) {
      return id;
    }
  }
  return null;
}

const SPECIAL_KEY_LABELS: Record<string, string> = {
  ' ': 'Space',
  Space: 'Space',
  Escape: 'Esc',
  Delete: 'Del',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

export function formatShortcutParts(
  binding: ShortcutBinding,
  mac = isMacPlatform()
): string[] {
  const parts: string[] = [];
  if (binding.mod) parts.push(mac ? '⌘' : 'Ctrl');
  if (binding.alt) parts.push(mac ? '⌥' : 'Alt');
  if (binding.shift) parts.push(mac ? '⇧' : 'Shift');

  if (binding.code === 'Space' || binding.key === ' ') {
    parts.push('Space');
    return parts;
  }

  const special = SPECIAL_KEY_LABELS[binding.key];
  if (special) {
    parts.push(special);
    return parts;
  }

  if (binding.key.length === 1) {
    parts.push(binding.key.toUpperCase());
    return parts;
  }

  parts.push(binding.key);
  return parts;
}

export function formatShortcutString(
  binding: ShortcutBinding,
  mac = isMacPlatform()
): string {
  return formatShortcutParts(binding, mac).join('+');
}
