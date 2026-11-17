import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from '../../types/workflow';
import {
  buildExportSvgString,
  CanvasExportLabels,
  exportCanvasToFile,
  ExportBackground,
  ExportFormat,
  ExportScope,
  getExportBounds,
  preloadNodeImages,
  ViewportCanvasRect,
} from '../../utils/canvasExport';
import {
  buildGlobalProjectReport,
  exportProjectReportToFile,
  ProjectReportLabels,
  ReportFormat,
} from '../../utils/projectReport';
import {
  Box,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Tag,
  X,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface ExportModalProps {
  appState: AppState;
  projectTitle: string;
  isDark: boolean;
  viewportRect: ViewportCanvasRect;
  onClose: () => void;
}

type ExportModalMode = 'canvas' | 'report';

export const ExportModal: React.FC<ExportModalProps> = ({
  appState,
  projectTitle,
  isDark,
  viewportRect,
  onClose,
}) => {
  const { t, tColumn, locale } = useLanguage();
  const [exportMode, setExportMode] = useState<ExportModalMode>('canvas');

  // Canvas Export State
  const [scope, setScope] = useState<ExportScope>('workspace');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [pngScale, setPngScale] = useState<1 | 2 | 3>(2);
  const [background, setBackground] = useState<ExportBackground>('theme');
  const [includeGrid, setIncludeGrid] = useState(true);
  const [imagesReadyVersion, setImagesReadyVersion] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Global Report State
  const [reportFormat, setReportFormat] = useState<ReportFormat>('html');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [includeTagMatrix, setIncludeTagMatrix] = useState(true);
  const [includeActorCatalog, setIncludeActorCatalog] = useState(true);
  const [includeSceneBreakdown, setIncludeSceneBreakdown] = useState(true);

  const imageCacheRef = useRef<Record<string, string>>({});

  const exportLabels = useMemo<CanvasExportLabels>(
    () => ({
      deletedImage: t('exportCanvas.deletedImage'),
      imageSnapshot: t('exportCanvas.imageSnapshot'),
      noImage: t('exportCanvas.noImage'),
      defaultScene: t('exportCanvas.defaultScene'),
      defaultContainer: t('exportCanvas.defaultContainer'),
      defaultStickyNote: t('exportCanvas.defaultStickyNote'),
      errRenderPng: t('exportCanvas.errRenderPng'),
      errCanvasInit: t('exportCanvas.errCanvasInit'),
      errEncodePng: t('exportCanvas.errEncodePng'),
    }),
    [t]
  );

  const reportLabels = useMemo<ProjectReportLabels>(
    () => ({
      reportTitle: t('report.title'),
      generatedAt: t('report.generatedAt'),
      filteredTagNote: t('report.filteredTagNote'),
      statScenes: t('report.statScenes'),
      statActors: t('report.statActors'),
      statTags: t('report.statTags'),
      statAssignments: t('report.statAssignments'),
      sectionTagMatrix: t('report.includeTagMatrix'),
      sectionActorCatalog: t('report.includeActorCatalog'),
      sectionSceneBreakdown: t('report.includeSceneBreakdown'),
      colTag: t('report.colTags'),
      colActorsCount: t('report.statActors'),
      colScenesCount: t('report.statScenes'),
      colActor: t('report.colActor'),
      colCategory: t('actorDetail.category'),
      colStates: t('report.colStates'),
      colTags: t('report.colTags'),
      colAppearances: t('report.colAppearances'),
      colScene: t('report.colScene'),
      colActorsStates: t('report.colActorsStates'),
      colFocus: tColumn('enfoque'),
      colAction: tColumn('accion'),
      colDescription: tColumn('descripcion'),
      noDescription: t('actorDetail.noDescription'),
      noneLabel: t('common.none'),
      removedActor: t('dashboard.actorMissing'),
    }),
    [t, tColumn]
  );

  useEffect(() => {
    let cancelled = false;
    preloadNodeImages(appState.nodes, imageCacheRef.current).then(() => {
      if (!cancelled) {
        setImagesReadyVersion((v) => v + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [appState.nodes]);

  const previewData = useMemo(() => {
    return buildExportSvgString({
      state: appState,
      scope,
      viewportRect,
      isDark,
      background,
      includeGrid,
      embeddedImages: imageCacheRef.current,
      labels: exportLabels,
    });
  }, [appState, scope, viewportRect, isDark, background, includeGrid, imagesReadyVersion, exportLabels]);

  const [previewUrl, setPreviewUrl] = useState<string>('');
  useEffect(() => {
    const blob = new Blob([previewData.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewData.svg]);

  const reportData = useMemo(
    () =>
      buildGlobalProjectReport({
        appState,
        projectTitle,
        selectedTag,
        labels: reportLabels,
      }),
    [appState, projectTitle, selectedTag, reportLabels]
  );

  const activeBounds = useMemo(
    () => getExportBounds({ state: appState, scope, viewportRect }),
    [appState, scope, viewportRect]
  );

  const effectiveMultiplier = format === 'png' ? pngScale : 1;
  const outputWidth = Math.round(activeBounds.width * effectiveMultiplier);
  const outputHeight = Math.round(activeBounds.height * effectiveMultiplier);

  const nodeCount = Object.keys(appState.nodes).length;
  const connCount = appState.connections.length;
  const containerCount = Object.values(appState.texts).filter((item) => item.mode === 'container').length;

  const handleDownload = async () => {
    setErrorMsg(null);
    setIsExporting(true);
    try {
      await exportCanvasToFile({
        state: appState,
        scope,
        viewportRect,
        isDark,
        background,
        includeGrid,
        format,
        pngScale,
        projectTitle,
        imageCache: imageCacheRef.current,
        labels: exportLabels,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('exportModal.error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadReport = () => {
    exportProjectReportToFile({
      report: reportData,
      format: reportFormat,
      includeTagMatrix,
      includeActorCatalog,
      includeSceneBreakdown,
      locale,
      labels: reportLabels,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#d4cfc3] dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#2b2924] dark:text-neutral-100">{t('exportModal.title')}</h3>
            <p className="text-xs text-[#5c584e] dark:text-neutral-400 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>{projectTitle}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{t('exportModal.scenesCount', { count: nodeCount })}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{t('exportModal.connectionsCount', { count: connCount })}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{t('exportModal.containersCount', { count: containerCount })}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="inline-flex p-1 bg-[#dcd7cc] dark:bg-neutral-950 rounded-lg border border-[#c3beb1] dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setExportMode('canvas')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  exportMode === 'canvas'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{t('exportModal.modeCanvas')}</span>
              </button>
              <button
                type="button"
                onClick={() => setExportMode('report')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  exportMode === 'report'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t('exportModal.modeReport')}</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#dcd7cc] hover:bg-[#d2ccbf] dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
              title={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {exportMode === 'canvas' ? (
          <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 overflow-y-auto">
            {/* Left: Live Preview */}
            <div className="md:col-span-7 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-[#5c584e] dark:text-neutral-400">
                <span className="font-medium text-[#3a362e] dark:text-neutral-300">{t('exportModal.preview')}</span>
                <span className="font-mono tabular-nums text-[#5c584e] dark:text-neutral-400">
                  {outputWidth} × {outputHeight} px
                </span>
              </div>

              <div
                className="relative w-full h-72 md:h-80 rounded-xl border border-[#c3beb1] dark:border-neutral-800 bg-[#dcd7cc]/70 dark:bg-neutral-950/60 overflow-hidden flex items-center justify-center p-3"
                style={{
                  backgroundColor: background === 'transparent' ? '#171717' : undefined,
                  backgroundImage:
                    background === 'transparent'
                      ? 'linear-gradient(45deg, #262626 25%, transparent 25%), linear-gradient(-45deg, #262626 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #262626 75%), linear-gradient(-45deg, transparent 75%, #262626 75%)'
                      : undefined,
                  backgroundSize: background === 'transparent' ? '16px 16px' : undefined,
                  backgroundPosition:
                    background === 'transparent' ? '0 0, 0 8px, 8px -8px, -8px 0' : undefined,
                }}
              >
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt={t('exportModal.previewAlt')}
                    className="max-w-full max-h-full object-contain rounded shadow-lg"
                  />
                )}
              </div>
            </div>

            {/* Right: Export Controls */}
            <div className="md:col-span-5 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                {/* Scope */}
                <div>
                  <label className="text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 block mb-1.5">
                    {t('exportModal.captureArea')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#dcd7cc] dark:bg-neutral-950 rounded-lg border border-[#c3beb1] dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setScope('workspace')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        scope === 'workspace'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t('exportModal.scopeWorkspace')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope('view')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        scope === 'view'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                      }`}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>{t('exportModal.scopeView')}</span>
                    </button>
                  </div>
                </div>

                {/* Format */}
                <div>
                  <label className="text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 block mb-1.5">
                    {t('exportModal.fileFormat')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#dcd7cc] dark:bg-neutral-950 rounded-lg border border-[#c3beb1] dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setFormat('png')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        format === 'png'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{t('exportModal.formatPng')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat('svg')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        format === 'svg'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t('exportModal.formatSvg')}</span>
                    </button>
                  </div>
                </div>

                {/* PNG Resolution */}
                {format === 'png' && (
                  <div>
                    <label className="text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 block mb-1.5">
                      {t('exportModal.pngScale')}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([1, 2, 3] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPngScale(s)}
                          className={`py-1.5 px-2 rounded-md border text-xs font-mono tabular-nums whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            pngScale === s
                              ? 'bg-blue-600/15 border-blue-600 text-blue-800 dark:bg-blue-600/20 dark:border-blue-500 dark:text-blue-300 font-semibold'
                              : 'bg-[#dcd7cc] border-[#c3beb1] text-[#5c584e] hover:text-[#1f1d18] dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                          }`}
                        >
                          {s}x{s === 2 ? ` ${t('exportModal.hd')}` : s === 3 ? ` ${t('exportModal.ultra')}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Background */}
                <div>
                  <label className="text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 block mb-1.5">
                    {t('exportModal.background')}
                  </label>
                  <select
                    value={background}
                    onChange={(e) => setBackground(e.target.value as ExportBackground)}
                    className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500"
                  >
                    <option value="theme" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                      {t('exportModal.bgTheme', {
                        theme: isDark ? t('exportModal.themeDark') : t('exportModal.themeLight'),
                      })}
                    </option>
                    <option value="white" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                      {t('exportModal.bgWhite')}
                    </option>
                    <option value="transparent" className="bg-[#ebe7de] text-[#2b2924] dark:bg-neutral-900 dark:text-neutral-200">
                      {t('exportModal.bgTransparent')}
                    </option>
                  </select>
                </div>

                {/* Grid Checkbox */}
                {background !== 'transparent' && (
                  <label className="flex items-center gap-2 text-xs text-[#3a362e] dark:text-neutral-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeGrid}
                      onChange={(e) => setIncludeGrid(e.target.checked)}
                      className="rounded border-[#c3beb1] dark:border-neutral-700 bg-[#e0dbd0] dark:bg-neutral-950 accent-blue-600"
                    />
                    <span>{t('exportModal.includeGrid')}</span>
                  </label>
                )}

                {errorMsg && (
                  <div className="p-2.5 rounded-lg bg-red-600/15 dark:bg-red-950/60 border border-red-600/35 dark:border-red-800/70 text-xs text-red-800 dark:text-red-300">
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-[#3a362e] hover:bg-[#dcd7cc] dark:text-neutral-300 dark:hover:bg-neutral-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isExporting
                      ? t('exportModal.exporting')
                      : t('exportModal.downloadFormat', { format: format.toUpperCase() })}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 overflow-y-auto">
            {/* Left: Global Report Live Preview */}
            <div className="md:col-span-7 flex flex-col gap-3 min-w-0">
              <div className="flex items-center justify-between text-[11px] text-[#5c584e] dark:text-neutral-400">
                <span className="font-medium text-[#3a362e] dark:text-neutral-300">
                  {t('report.previewTitle')}
                </span>
                {selectedTag !== 'all' && (
                  <span className="font-mono text-blue-700 dark:text-blue-300">
                    #{selectedTag}
                  </span>
                )}
              </div>

              {/* Stat Strip */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg border border-[#c8c3b6] dark:border-neutral-800 bg-[#e0dbd0] dark:bg-neutral-950 p-2.5">
                  <div className="text-base font-bold text-[#2b2924] dark:text-neutral-100 tabular-nums">
                    {reportData.sceneRows.length}
                  </div>
                  <div className="text-[10px] text-[#5c584e] dark:text-neutral-400 truncate">
                    {t('report.statScenes')}
                  </div>
                </div>
                <div className="rounded-lg border border-[#c8c3b6] dark:border-neutral-800 bg-[#e0dbd0] dark:bg-neutral-950 p-2.5">
                  <div className="text-base font-bold text-[#2b2924] dark:text-neutral-100 tabular-nums">
                    {reportData.actorRows.length}
                  </div>
                  <div className="text-[10px] text-[#5c584e] dark:text-neutral-400 truncate">
                    {t('report.statActors')}
                  </div>
                </div>
                <div className="rounded-lg border border-[#c8c3b6] dark:border-neutral-800 bg-[#e0dbd0] dark:bg-neutral-950 p-2.5">
                  <div className="text-base font-bold text-[#2b2924] dark:text-neutral-100 tabular-nums">
                    {reportData.tagMatrix.length}
                  </div>
                  <div className="text-[10px] text-[#5c584e] dark:text-neutral-400 truncate">
                    {t('report.statTags')}
                  </div>
                </div>
                <div className="rounded-lg border border-[#c8c3b6] dark:border-neutral-800 bg-[#e0dbd0] dark:bg-neutral-950 p-2.5">
                  <div className="text-base font-bold text-[#2b2924] dark:text-neutral-100 tabular-nums">
                    {reportData.totalAssignments}
                  </div>
                  <div className="text-[10px] text-[#5c584e] dark:text-neutral-400 truncate">
                    {t('report.statAssignments')}
                  </div>
                </div>
              </div>

              {/* Scrollable Report Content Preview */}
              <div className="h-64 md:h-72 rounded-xl border border-[#c3beb1] dark:border-neutral-800 bg-[#e0dbd0]/60 dark:bg-neutral-950/70 p-3 overflow-y-auto space-y-4">
                {reportData.actorRows.length === 0 && reportData.sceneRows.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#6e695d] dark:text-neutral-500 text-center px-4">
                    {t('report.noMatchingData')}
                  </div>
                ) : (
                  <>
                    {includeTagMatrix && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-[#3a362e] dark:text-neutral-300 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                          <span>{t('report.includeTagMatrix')}</span>
                        </div>
                        {reportData.tagMatrix.length === 0 ? (
                          <p className="text-[11px] text-[#6e695d] dark:text-neutral-500">
                            {t('report.noTagsInProject')}
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {reportData.tagMatrix.map((row) => (
                              <button
                                key={row.tag}
                                type="button"
                                onClick={() =>
                                  setSelectedTag((curr) => (curr === row.tag ? 'all' : row.tag))
                                }
                                className={`px-2 py-1 rounded-md border text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                                  selectedTag === row.tag
                                    ? 'bg-blue-600 text-white border-blue-500'
                                    : 'bg-[#ebe7de] dark:bg-neutral-900 border-[#c8c3b6] dark:border-neutral-800 text-[#2b2924] dark:text-neutral-200 hover:border-blue-500/60'
                                }`}
                              >
                                <span className="font-mono">#{row.tag}</span>
                                <span className="text-[10px] opacity-80 tabular-nums">
                                  ({t('report.tagUsageCount', {
                                    actors: row.actorNames.length,
                                    scenes: row.sceneTitles.length,
                                  })})
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {includeActorCatalog && reportData.actorRows.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-[#3a362e] dark:text-neutral-300 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Box className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                            <span>{t('report.includeActorCatalog')}</span>
                          </span>
                          <span className="text-[10px] text-[#5c584e] dark:text-neutral-400 tabular-nums">
                            {t('report.actorCountLabel', { count: reportData.actorRows.length })}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {reportData.actorRows.map(({ actor, appearances }) => (
                            <div
                              key={actor.id}
                              className="flex items-start gap-2.5 p-2 rounded-lg bg-[#ebe7de] dark:bg-neutral-900 border border-[#c8c3b6] dark:border-neutral-800"
                            >
                              <div className="w-8 h-8 rounded-md overflow-hidden bg-[#dcd7cc] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-700 flex items-center justify-center shrink-0">
                                {actor.thumbnailUrl ? (
                                  <img
                                    src={actor.thumbnailUrl}
                                    alt={actor.name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Box className="w-4 h-4 text-[#5c584e] dark:text-neutral-500" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-[#2b2924] dark:text-neutral-100 truncate">
                                    {actor.name}
                                  </span>
                                  <span className="text-[10px] text-[#5c584e] dark:text-neutral-400 tabular-nums shrink-0">
                                    {t('report.sceneCountLabel', { count: appearances.length })}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {actor.states.map((st) => (
                                    <span
                                      key={st.id}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 text-[10px] text-[#3a362e] dark:text-neutral-300"
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: st.color }}
                                      />
                                      <span>{st.label}</span>
                                    </span>
                                  ))}
                                  {actor.tags.map((tg) => (
                                    <span
                                      key={tg}
                                      className="px-1.5 py-0.5 rounded bg-blue-600/12 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 text-[10px] font-mono"
                                    >
                                      #{tg}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {includeSceneBreakdown && reportData.sceneRows.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-[#3a362e] dark:text-neutral-300 flex items-center justify-between">
                          <span>{t('report.includeSceneBreakdown')}</span>
                          <span className="text-[10px] text-[#5c584e] dark:text-neutral-400 tabular-nums">
                            {t('report.sceneCountLabel', { count: reportData.sceneRows.length })}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {reportData.sceneRows.map(({ node, actors: sActors }) => (
                            <div
                              key={node.id}
                              className="p-2 rounded-lg bg-[#ebe7de] dark:bg-neutral-900 border border-[#c8c3b6] dark:border-neutral-800 space-y-1"
                            >
                              <div className="text-xs font-semibold text-[#2b2924] dark:text-neutral-100 truncate">
                                {node.title || node.id}
                              </div>
                              {sActors.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {sActors.map((sa) => (
                                    <span
                                      key={sa.assignmentId}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 text-[10px] text-[#3a362e] dark:text-neutral-200"
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: sa.stateColor }}
                                      />
                                      <span className="font-medium">{sa.actorName}:</span>
                                      <span>{sa.stateLabel}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-[#6e695d] dark:text-neutral-500">
                                  {t('dashboard.noActorsInScene')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right: Report Controls */}
            <div className="md:col-span-5 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <p className="text-xs text-[#5c584e] dark:text-neutral-400 leading-relaxed">
                  {t('report.subtitle')}
                </p>

                {/* Tag Filter */}
                <div>
                  <label className="text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 block mb-1.5">
                    {t('report.filterByTag')}
                  </label>
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="w-full bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#2b2924] dark:text-neutral-100 outline-none focus:border-blue-500"
                  >
                    <option value="all">{t('report.allTags')}</option>
                    {reportData.allTags.map((tg) => (
                      <option key={tg} value={tg}>
                        #{tg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Format Switcher */}
                <div>
                  <label className="text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 block mb-1.5">
                    {t('report.formatLabel')}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#dcd7cc] dark:bg-neutral-950 rounded-lg border border-[#c3beb1] dark:border-neutral-800">
                    {(
                      [
                        { key: 'html', label: t('report.formatHtml') },
                        { key: 'csv', label: t('report.formatCsv') },
                        { key: 'json', label: t('report.formatJson') },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setReportFormat(opt.key)}
                        className={`py-1.5 px-2 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          reportFormat === opt.key
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-[#5c584e] hover:text-[#1f1d18] dark:text-neutral-400 dark:hover:text-neutral-200'
                        }`}
                      >
                        {opt.key.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#6e695d] dark:text-neutral-500 mt-1">
                    {reportFormat === 'html'
                      ? t('report.formatHtml')
                      : reportFormat === 'csv'
                      ? t('report.formatCsv')
                      : t('report.formatJson')}
                  </p>
                </div>

                {/* Sections Checkboxes */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-[#5c584e] dark:text-neutral-400 block">
                    {t('report.sectionsLabel')}
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#3a362e] dark:text-neutral-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeTagMatrix}
                      onChange={(e) => setIncludeTagMatrix(e.target.checked)}
                      className="rounded border-[#c3beb1] dark:border-neutral-700 bg-[#e0dbd0] dark:bg-neutral-950 accent-blue-600"
                    />
                    <span>{t('report.includeTagMatrix')}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#3a362e] dark:text-neutral-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeActorCatalog}
                      onChange={(e) => setIncludeActorCatalog(e.target.checked)}
                      className="rounded border-[#c3beb1] dark:border-neutral-700 bg-[#e0dbd0] dark:bg-neutral-950 accent-blue-600"
                    />
                    <span>{t('report.includeActorCatalog')}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#3a362e] dark:text-neutral-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeSceneBreakdown}
                      onChange={(e) => setIncludeSceneBreakdown(e.target.checked)}
                      className="rounded border-[#c3beb1] dark:border-neutral-700 bg-[#e0dbd0] dark:bg-neutral-950 accent-blue-600"
                    />
                    <span>{t('report.includeSceneBreakdown')}</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-[#3a362e] hover:bg-[#dcd7cc] dark:text-neutral-300 dark:hover:bg-neutral-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={!includeTagMatrix && !includeActorCatalog && !includeSceneBreakdown}
                  onClick={handleDownloadReport}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('report.downloadReport', { format: reportFormat.toUpperCase() })}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

