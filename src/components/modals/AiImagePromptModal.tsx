import React, { useMemo, useState } from 'react';
import { Check, Loader2, RefreshCw, Sparkles, Wand2, X } from 'lucide-react';
import { dataUrlToImageFile, generateOrEditGeminiImage } from '../../services/geminiImageService';
import { useLanguage } from '../../hooks/useLanguage';

interface AiImagePromptModalProps {
  mode: 'create' | 'edit';
  targetKind: 'image' | 'map';
  sourceImageUrl?: string | null;
  defaultTitle?: string;
  userApiKey: string | null;
  applyButtonLabel?: string;
  onApplyFile: (file: File) => Promise<void>;
  onClose: () => void;
}

const IMAGE_SIZES = ['1K', '2K', '4K'];

export const AiImagePromptModal: React.FC<AiImagePromptModalProps> = ({
  mode,
  targetKind,
  sourceImageUrl,
  defaultTitle,
  userApiKey,
  applyButtonLabel,
  onApplyFile,
  onClose,
}) => {
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [imageSize, setImageSize] = useState('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [generatedDataUrl, setGeneratedDataUrl] = useState<string | null>(null);
  const [modelNote, setModelNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const aspectRatios = useMemo(
    () => [
      { value: '16:9', label: t('aiModal.ar169') },
      { value: '4:3', label: t('aiModal.ar43') },
      { value: '1:1', label: t('aiModal.ar11') },
      { value: '3:4', label: t('aiModal.ar34') },
      { value: '9:16', label: t('aiModal.ar916') },
    ],
    [t]
  );

  const isEdit = mode === 'edit';
  const kindLabel = targetKind === 'map' ? t('aiModal.kindMap') : t('aiModal.kindImage');
  const kindLower = targetKind === 'map' ? t('aiModal.kindMapLower') : t('aiModal.kindImageLower');
  const headerTitle = isEdit
    ? t('aiModal.editTitle', { kind: kindLabel })
    : t('aiModal.createTitle', { kind: kindLabel });
  const defaultApplyLabel =
    applyButtonLabel || (targetKind === 'map' ? t('aiModal.applyMap') : t('aiModal.applyImage'));

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError(t('aiModal.errEmptyPrompt'));
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const result = await generateOrEditGeminiImage({
        mode,
        prompt: trimmed,
        sourceImageUrl: isEdit ? sourceImageUrl : undefined,
        aspectRatio,
        imageSize,
        userApiKey,
      });
      setGeneratedDataUrl(result.imageDataUrl);
      setModelNote(result.text || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiModal.errGenerate'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!generatedDataUrl) return;
    setError(null);
    setIsApplying(true);
    try {
      const baseName = `${defaultTitle || targetKind}-${mode}`;
      const file = dataUrlToImageFile(generatedDataUrl, baseName);
      await onApplyFile(file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiModal.errSave'));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#d4cfc3] dark:border-neutral-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600/15 dark:bg-emerald-600/20 border border-emerald-600/35 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
              {isEdit ? <Wand2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#2b2924] dark:text-neutral-100 truncate">{headerTitle}</h3>
              {defaultTitle && (
                <p className="text-[11px] text-[#5c584e] dark:text-neutral-400 truncate">{defaultTitle}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={isGenerating || isApplying}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Preview Area */}
          {isEdit && sourceImageUrl ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5c584e] dark:text-neutral-400">
                  {t('aiModal.currentKind', { kind: kindLabel })}
                </span>
                <div className="aspect-video rounded-xl overflow-hidden bg-[#ddd8cd] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800">
                  <img
                    src={sourceImageUrl}
                    alt={t('aiModal.currentRefAlt')}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {t('aiModal.editedPreview')}
                </span>
                <div className="aspect-video rounded-xl overflow-hidden bg-[#ddd8cd] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 flex items-center justify-center relative">
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-2 text-xs text-[#5c584e] dark:text-neutral-400">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span>{t('aiModal.editingStatus', { kind: kindLower })}</span>
                    </div>
                  ) : generatedDataUrl ? (
                    <img
                      src={generatedDataUrl}
                      alt={t('aiModal.generatedResultAlt')}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] text-[#6e695d] dark:text-neutral-500 px-4 text-center">
                      {t('aiModal.editHint')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            (isGenerating || generatedDataUrl) && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {t('aiModal.generatedPreview')}
                </span>
                <div className="aspect-video max-h-72 mx-auto rounded-xl overflow-hidden bg-[#ddd8cd] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 flex items-center justify-center">
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-2 text-xs text-[#5c584e] dark:text-neutral-400">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span>{t('aiModal.creatingStatus', { kind: kindLower })}</span>
                    </div>
                  ) : generatedDataUrl ? (
                    <img
                      src={generatedDataUrl}
                      alt={t('aiModal.generatedPreviewAlt')}
                      className="w-full h-full object-contain"
                    />
                  ) : null}
                </div>
              </div>
            )
          )}

          {modelNote && (
            <p className="text-[11px] text-[#433f37] dark:text-neutral-400 bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c8c3b6] dark:border-neutral-800 rounded-lg px-3 py-2">
              {modelNote}
            </p>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-600/12 dark:bg-red-950/60 border border-red-600/35 dark:border-red-700/60 text-xs text-red-800 dark:text-red-200 break-words">
              {error}
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#3a362e] dark:text-neutral-300">
              {t('aiModal.promptLabel')}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isGenerating && !isApplying) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              rows={3}
              autoFocus
              placeholder={
                isEdit
                  ? targetKind === 'map'
                    ? t('aiModal.placeholderEditMap')
                    : t('aiModal.placeholderEditImage')
                  : targetKind === 'map'
                  ? t('aiModal.placeholderCreateMap')
                  : t('aiModal.placeholderCreateImage')
              }
              className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl p-3 text-xs text-[#2b2924] dark:text-neutral-100 outline-none resize-none placeholder:text-[#757065] dark:placeholder:text-neutral-600"
            />
          </div>

          {/* Aspect Ratio & Resolution */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5c584e] dark:text-neutral-400">
                {t('aiModal.aspectRatio')}
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                disabled={isGenerating || isApplying}
                className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs text-[#2b2924] dark:text-neutral-200 outline-none focus:border-emerald-600 dark:focus:border-emerald-500 cursor-pointer"
              >
                {aspectRatios.map((ar) => (
                  <option key={ar.value} value={ar.value} className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                    {ar.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5c584e] dark:text-neutral-400">
                {t('aiModal.resolution')}
              </label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                disabled={isGenerating || isApplying}
                className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs text-[#2b2924] dark:text-neutral-200 outline-none focus:border-emerald-600 dark:focus:border-emerald-500 cursor-pointer"
              >
                {IMAGE_SIZES.map((sz) => (
                  <option key={sz} value={sz} className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                    {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#d4cfc3] dark:border-neutral-800 bg-[#e3ded3] dark:bg-neutral-950/60 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={isGenerating || isApplying}
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] text-[#3a362e] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            {t('common.cancel')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isGenerating || isApplying || !prompt.trim()}
              onClick={handleGenerate}
              className="px-4 py-1.5 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] disabled:opacity-50 border border-[#c3beb1] text-[#2b2924] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:border-neutral-700 dark:text-neutral-100 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>{t('aiModal.generating')}</span>
                </>
              ) : generatedDataUrl ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('aiModal.regenerate')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('aiModal.generate')}</span>
                </>
              )}
            </button>

            {generatedDataUrl && (
              <button
                type="button"
                disabled={isGenerating || isApplying}
                onClick={handleApply}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('common.saving')}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{defaultApplyLabel}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
