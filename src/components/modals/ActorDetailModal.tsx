import React from 'react';
import { ActorItem, WorkflowNode } from '../../types/workflow';
import { Box, Calendar, Layers, Pencil, Tag, User, X } from 'lucide-react';
import { ResolvedImg } from '../ResolvedImg';
import { useLanguage } from '../../hooks/useLanguage';

interface ActorDetailModalProps {
  actor: ActorItem;
  nodes: Record<string, WorkflowNode>;
  isReadOnly?: boolean;
  onClose: () => void;
  onEdit?: (actor: ActorItem) => void;
  onOpenNode?: (nodeId: string) => void;
}

export const ActorDetailModal: React.FC<ActorDetailModalProps> = ({
  actor,
  nodes,
  isReadOnly = false,
  onClose,
  onEdit,
  onOpenNode,
}) => {
  const { t, locale } = useLanguage();

  const sceneAppearances = Object.values(nodes)
    .map((node) => {
      const matches = (node.actors || []).filter((a) => a.actorId === actor.id);
      if (matches.length === 0) return null;
      return {
        node,
        assignments: matches.map((m) => {
          const liveState = actor.states.find((s) => s.id === m.stateId);
          return {
            id: m.id,
            label: liveState?.label || m.stateLabel || t('dashboard.stateFallback'),
            color: liveState?.color || '#3b82f6',
          };
        }),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const formattedUpdated = actor.updatedAt
    ? new Date(actor.updatedAt).toLocaleDateString(locale)
    : '—';

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Box className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
            <h3 className="text-sm font-bold text-[#2b2924] dark:text-neutral-100 truncate">
              {actor.name}
            </h3>
            <span className="text-xs text-[#635e54] dark:text-neutral-400 shrink-0">
              · {actor.category || t('actorLib.defaultCategory')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isReadOnly && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(actor)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t('actorDetail.editInLibrary')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
              title={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left: Enlarged Thumbnail Preview */}
          <div className="md:col-span-5 flex flex-col gap-3">
            <div className="aspect-square w-full rounded-xl overflow-hidden bg-[#dbd6ca] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 flex items-center justify-center">
              {actor.thumbnailUrl ? (
                <ResolvedImg
                  src={actor.thumbnailUrl}
                  alt={actor.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-[#6e695d] dark:text-neutral-500 p-6 text-center">
                  <Box className="w-12 h-12 opacity-60" />
                  <span className="text-xs font-medium">{actor.name}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5c584e] dark:text-neutral-400 px-1">
              <span className="inline-flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{t('actorDetail.author')}: {actor.author || t('common.unknown')}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Calendar className="w-3 h-3" />
                <span>{t('actorDetail.updated')}: {formattedUpdated}</span>
              </span>
            </div>
          </div>

          {/* Right: Structured Metadata, States, Tags & Scene Usage */}
          <div className="md:col-span-7 space-y-5">
            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300">
                {t('actorDetail.description')}
              </h4>
              <p className="text-xs text-[#2b2924] dark:text-neutral-200 leading-relaxed whitespace-pre-wrap bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800 rounded-xl p-3">
                {actor.description?.trim() || t('actorDetail.noDescription')}
              </p>
            </div>

            {/* Configured States */}
            <div className="space-y-2 border-t border-[#d4cfc3] dark:border-neutral-800 pt-4">
              <h4 className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                <span>{t('actorDetail.configuredStates', { count: actor.states.length })}</span>
              </h4>
              {actor.states.length === 0 ? (
                <p className="text-xs text-[#6e695d] dark:text-neutral-500">
                  {t('actorLib.noStatesYet')}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {actor.states.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800 text-xs text-[#2b2924] dark:text-neutral-200"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/15"
                        style={{ backgroundColor: st.color || '#3b82f6' }}
                      />
                      <span className="truncate font-medium">{st.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Project Tags */}
            <div className="space-y-1.5 border-t border-[#d4cfc3] dark:border-neutral-800 pt-4">
              <h4 className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>{t('actorDetail.tags', { count: actor.tags.length })}</span>
              </h4>
              {actor.tags.length === 0 ? (
                <p className="text-xs text-[#6e695d] dark:text-neutral-500">
                  {t('actorDetail.noTags')}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#3a362e] dark:text-neutral-300 font-mono">
                  {actor.tags.map((tag, idx) => (
                    <React.Fragment key={tag}>
                      {idx > 0 && <span className="text-[#9b9588] dark:text-neutral-600" aria-hidden="true">·</span>}
                      <span>#{tag}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Scene Appearances */}
            <div className="space-y-2 border-t border-[#d4cfc3] dark:border-neutral-800 pt-4">
              <h4 className="text-xs font-semibold text-[#3a362e] dark:text-neutral-300">
                {t('actorDetail.sceneAppearances', { count: sceneAppearances.length })}
              </h4>
              {sceneAppearances.length === 0 ? (
                <p className="text-xs text-[#6e695d] dark:text-neutral-500">
                  {t('actorDetail.noAppearances')}
                </p>
              ) : (
                <div className="divide-y divide-[#d4cfc3] dark:divide-neutral-800 border border-[#c8c3b6] dark:border-neutral-800 rounded-xl bg-[#e0dbd0] dark:bg-neutral-950 overflow-hidden">
                  {sceneAppearances.map(({ node, assignments }) => (
                    <div
                      key={node.id}
                      className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                    >
                      {onOpenNode ? (
                        <button
                          type="button"
                          onClick={() => onOpenNode(node.id)}
                          className="font-semibold text-blue-700 dark:text-blue-400 hover:underline truncate text-left cursor-pointer"
                        >
                          {node.title || t('node.untitledScene')}
                        </button>
                      ) : (
                        <span className="font-semibold text-[#2b2924] dark:text-neutral-200 truncate">
                          {node.title || t('node.untitledScene')}
                        </span>
                      )}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-[#635e54] dark:text-neutral-500">
                          {t('actorDetail.stateInScene')}
                        </span>
                        {assignments.map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1.5 font-medium text-[#2b2924] dark:text-neutral-100"
                          >
                            <span
                              className="w-2 h-2 rounded-sm shrink-0"
                              style={{ backgroundColor: a.color }}
                            />
                            <span>{a.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
