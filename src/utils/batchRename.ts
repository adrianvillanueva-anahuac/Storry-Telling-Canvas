import { WorkflowNode } from '../types/workflow';

export type BatchRenameMode = 'prefix-suffix' | 'sequence';
export type SequenceTargetMode = 'replace-base' | 'append-title' | 'prepend-title';
export type BatchRenameSortOrder = 'left-to-right' | 'top-to-bottom' | 'selection';

export interface BatchRenameConfig {
  mode: BatchRenameMode;
  prefix: string;
  suffix: string;
  sequenceTarget: SequenceTargetMode;
  baseName: string;
  startNumber: number;
  step: number;
  padDigits: number;
  separator: string;
  sortOrder: BatchRenameSortOrder;
}

export interface BatchRenamePreviewItem {
  id: string;
  oldTitle: string;
  newTitle: string;
  changed: boolean;
}

export function sortNodesForBatchRename(
  nodes: WorkflowNode[],
  sortOrder: BatchRenameSortOrder
): WorkflowNode[] {
  if (sortOrder === 'selection') {
    return [...nodes];
  }

  return [...nodes].sort((a, b) => {
    const ax = parseFloat(a.x) || 0;
    const ay = parseFloat(a.y) || 0;
    const bx = parseFloat(b.x) || 0;
    const by = parseFloat(b.y) || 0;

    if (sortOrder === 'left-to-right') {
      if (Math.abs(ax - bx) > 0.5) return ax - bx;
      if (Math.abs(ay - by) > 0.5) return ay - by;
    } else {
      if (Math.abs(ay - by) > 0.5) return ay - by;
      if (Math.abs(ax - bx) > 0.5) return ax - bx;
    }

    return a.id.localeCompare(b.id);
  });
}

export function formatSequenceNumber(value: number, padDigits: number): string {
  const safeNum = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const safeDigits = Number.isFinite(padDigits) ? Math.max(1, Math.min(6, Math.floor(padDigits))) : 1;
  return String(safeNum).padStart(safeDigits, '0');
}

export function computeBatchRenamePreview(
  nodes: WorkflowNode[],
  config: BatchRenameConfig
): BatchRenamePreviewItem[] {
  const ordered =
    config.mode === 'sequence'
      ? sortNodesForBatchRename(nodes, config.sortOrder)
      : [...nodes];

  const safeStart = Number.isFinite(config.startNumber)
    ? Math.max(0, Math.floor(config.startNumber))
    : 1;
  const safeStep = Number.isFinite(config.step)
    ? Math.max(1, Math.floor(config.step))
    : 1;

  return ordered.map((node, index) => {
    const oldTitle = node.title || '';
    let newTitle = oldTitle;

    if (config.mode === 'prefix-suffix') {
      newTitle = `${config.prefix}${oldTitle}${config.suffix}`;
    } else {
      const seqNum = formatSequenceNumber(safeStart + index * safeStep, config.padDigits);
      if (config.sequenceTarget === 'replace-base') {
        const cleanBase = config.baseName.trim();
        newTitle = cleanBase ? `${cleanBase}${config.separator}${seqNum}` : seqNum;
      } else if (config.sequenceTarget === 'append-title') {
        newTitle = `${oldTitle}${config.separator}${seqNum}`;
      } else {
        newTitle = `${seqNum}${config.separator}${oldTitle}`;
      }
    }

    return {
      id: node.id,
      oldTitle,
      newTitle,
      changed: newTitle !== oldTitle,
    };
  });
}
