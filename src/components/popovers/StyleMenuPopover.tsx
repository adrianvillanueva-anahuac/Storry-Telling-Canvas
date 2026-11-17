import React from 'react';
import { Moon, RotateCcw, Sun } from 'lucide-react';
import { CanvasStyleSettings } from '../../types/workflow';
import { useLanguage } from '../../hooks/useLanguage';

interface StyleMenuPopoverProps {
  styleSettings: CanvasStyleSettings;
  onChange: (updater: (prev: CanvasStyleSettings) => CanvasStyleSettings) => void;
  onResetCurrentTheme: () => void;
}

interface ToggleSwitchProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onToggle, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onToggle}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
      checked
        ? 'bg-blue-600 border-blue-500'
        : 'bg-[#cdc7ba] border-[#b5afa0] dark:bg-neutral-800 dark:border-neutral-700'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`}
    />
  </button>
);

export const StyleMenuPopover: React.FC<StyleMenuPopoverProps> = ({
  styleSettings,
  onChange,
  onResetCurrentTheme,
}) => {
  const { t } = useLanguage();
  const themeKey = styleSettings.isDark ? 'dark' : 'light';
  const activeColors = styleSettings.themeColors[themeKey];

  const updateThemeColor = (field: 'farDotColor' | 'nearDotColor', value: string) => {
    onChange((prev) => {
      const key = prev.isDark ? 'dark' : 'light';
      return {
        ...prev,
        themeColors: {
          ...prev.themeColors,
          [key]: {
            ...prev.themeColors[key],
            [field]: value,
          },
        },
      };
    });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-80 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-4.5rem)] overflow-y-auto bg-[#ebe7de] dark:bg-neutral-900 border border-[#c3beb1] dark:border-neutral-700/80 rounded-xl shadow-2xl z-50 text-xs text-[#2b2924] dark:text-neutral-100 select-none"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-tight text-[#2b2924] dark:text-neutral-100">
          {t('stylePopover.title')}
        </span>
        <button
          type="button"
          onClick={onResetCurrentTheme}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#5c584e] hover:text-[#1f1d18] hover:bg-[#dfdacf] dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          title={t('stylePopover.resetTitle')}
        >
          <RotateCcw className="w-3 h-3" />
          <span>{t('stylePopover.reset')}</span>
        </button>
      </div>

      {/* 1. Dark Mode */}
      <div className="px-4 py-3 border-b border-[#d4cfc3] dark:border-neutral-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {styleSettings.isDark ? (
            <Moon className="w-4 h-4 text-blue-400 shrink-0" />
          ) : (
            <Sun className="w-4 h-4 text-amber-700 shrink-0" />
          )}
          <div>
            <div className="font-semibold text-[#2b2924] dark:text-neutral-100">{t('stylePopover.darkMode')}</div>
            <div className="text-[11px] text-[#5c584e] dark:text-neutral-400">
              {styleSettings.isDark ? t('stylePopover.darkModeOn') : t('stylePopover.darkModeOff')}
            </div>
          </div>
        </div>
        <ToggleSwitch
          checked={styleSettings.isDark}
          label={t('stylePopover.darkModeAria')}
          onToggle={() => onChange((prev) => ({ ...prev, isDark: !prev.isDark }))}
        />
      </div>

      {/* 2, 3, 4. Reactive Background & Dot Colors */}
      <div className="px-4 py-3 border-b border-[#d4cfc3] dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-[#2b2924] dark:text-neutral-100">
              {t('stylePopover.reactiveEffect')}
            </div>
            <div className="text-[11px] text-[#5c584e] dark:text-neutral-400">
              {t('stylePopover.reactiveDesc')}
            </div>
          </div>
          <ToggleSwitch
            checked={styleSettings.reactiveEnabled}
            label={t('stylePopover.reactiveAria')}
            onToggle={() =>
              onChange((prev) => ({ ...prev, reactiveEnabled: !prev.reactiveEnabled }))
            }
          />
        </div>

        {/* Percentage of Reactive Effect */}
        <div className={`space-y-1.5 transition-opacity ${styleSettings.reactiveEnabled ? '' : 'opacity-45'}`}>
          <div className="flex items-center justify-between text-[11px]">
            <label htmlFor="style-reactive-intensity" className="text-[#433f37] dark:text-neutral-300 font-medium">
              {t('stylePopover.effectIntensity')}
            </label>
            <span className="font-mono tabular-nums text-[#2b2924] dark:text-neutral-200 font-semibold">
              {styleSettings.reactiveIntensity}%
            </span>
          </div>
          <input
            id="style-reactive-intensity"
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={!styleSettings.reactiveEnabled}
            value={styleSettings.reactiveIntensity}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange((prev) => ({ ...prev, reactiveIntensity: val }));
            }}
            className="w-full accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        {/* Gradient Radius near cursor */}
        <div className={`space-y-1.5 transition-opacity ${styleSettings.reactiveEnabled ? '' : 'opacity-45'}`}>
          <div className="flex items-center justify-between text-[11px]">
            <label htmlFor="style-reactive-radius" className="text-[#433f37] dark:text-neutral-300 font-medium">
              {t('stylePopover.gradientRadius')}
            </label>
            <span className="font-mono tabular-nums text-[#2b2924] dark:text-neutral-200 font-semibold">
              {styleSettings.reactiveRadius} px
            </span>
          </div>
          <input
            id="style-reactive-radius"
            type="range"
            min={80}
            max={520}
            step={10}
            disabled={!styleSettings.reactiveEnabled}
            value={styleSettings.reactiveRadius}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange((prev) => ({ ...prev, reactiveRadius: val }));
            }}
            className="w-full accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        {/* Far & Near Dot Colors */}
        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <label className="block space-y-1 cursor-pointer">
            <span className="text-[11px] text-[#433f37] dark:text-neutral-300 font-medium block">
              {t('stylePopover.farDots')}
            </span>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 hover:border-blue-600/60 dark:hover:border-blue-500/60 transition-colors">
              <input
                type="color"
                value={activeColors.farDotColor}
                onChange={(e) => updateThemeColor('farDotColor', e.target.value)}
                aria-label={t('stylePopover.farDotsAria')}
                className="w-5 h-5 rounded border-0 bg-transparent p-0 cursor-pointer shrink-0"
              />
              <span className="font-mono tabular-nums text-[11px] uppercase text-[#2b2924] dark:text-neutral-200 truncate">
                {activeColors.farDotColor}
              </span>
            </div>
          </label>

          <label className="block space-y-1 cursor-pointer">
            <span className="text-[11px] text-[#433f37] dark:text-neutral-300 font-medium block">
              {t('stylePopover.nearEffect')}
            </span>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#e0dbd0] dark:bg-neutral-950 border border-[#c3beb1] dark:border-neutral-800 hover:border-blue-600/60 dark:hover:border-blue-500/60 transition-colors">
              <input
                type="color"
                value={activeColors.nearDotColor}
                onChange={(e) => updateThemeColor('nearDotColor', e.target.value)}
                aria-label={t('stylePopover.nearEffectAria')}
                className="w-5 h-5 rounded border-0 bg-transparent p-0 cursor-pointer shrink-0"
              />
              <span className="font-mono tabular-nums text-[11px] uppercase text-[#2b2924] dark:text-neutral-200 truncate">
                {activeColors.nearDotColor}
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* 5. Background Vignette */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-[#2b2924] dark:text-neutral-100">
              {t('stylePopover.vignette')}
            </div>
            <div className="text-[11px] text-[#5c584e] dark:text-neutral-400">
              {t('stylePopover.vignetteDesc')}
            </div>
          </div>
          <ToggleSwitch
            checked={styleSettings.vignetteEnabled}
            label={t('stylePopover.vignetteAria')}
            onToggle={() =>
              onChange((prev) => ({ ...prev, vignetteEnabled: !prev.vignetteEnabled }))
            }
          />
        </div>

        <div className={`space-y-1.5 transition-opacity ${styleSettings.vignetteEnabled ? '' : 'opacity-45'}`}>
          <div className="flex items-center justify-between text-[11px]">
            <label htmlFor="style-vignette-intensity" className="text-[#433f37] dark:text-neutral-300 font-medium">
              {t('stylePopover.vignetteIntensity')}
            </label>
            <span className="font-mono tabular-nums text-[#2b2924] dark:text-neutral-200 font-semibold">
              {styleSettings.vignetteIntensity}%
            </span>
          </div>
          <input
            id="style-vignette-intensity"
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={!styleSettings.vignetteEnabled}
            value={styleSettings.vignetteIntensity}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange((prev) => ({ ...prev, vignetteIntensity: val }));
            }}
            className="w-full accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        <div className={`space-y-1.5 transition-opacity ${styleSettings.vignetteEnabled ? '' : 'opacity-45'}`}>
          <div className="flex items-center justify-between text-[11px]">
            <label htmlFor="style-vignette-gradient" className="text-[#433f37] dark:text-neutral-300 font-medium">
              {t('stylePopover.vignetteGradient')}
            </label>
            <span className="font-mono tabular-nums text-[#2b2924] dark:text-neutral-200 font-semibold">
              {styleSettings.vignetteGradient}%
            </span>
          </div>
          <input
            id="style-vignette-gradient"
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={!styleSettings.vignetteEnabled}
            value={styleSettings.vignetteGradient}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange((prev) => ({ ...prev, vignetteGradient: val }));
            }}
            className="w-full accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
};
