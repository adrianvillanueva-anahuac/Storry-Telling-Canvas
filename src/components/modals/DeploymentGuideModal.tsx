import React, { useState } from 'react';
import {
  X,
  Rocket,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  ShieldCheck,
  Globe,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Circle,
  FileCode2,
  Download,
  FolderTree,
  Loader2,
} from 'lucide-react';

interface DeploymentGuideModalProps {
  onClose: () => void;
  projectId?: string;
}

export const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({
  onClose,
  projectId = 'massive-artwork-d07pf',
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadZip = async () => {
    try {
      setDownloading(true);
      const res = await fetch('/api/download-project');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'visual-workflow-canvas.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback direct link
      window.open('/api/download-project', '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const hostingUrl = `https://${projectId}.web.app`;
  const consoleUrl = `https://console.firebase.google.com/project/${projectId}/overview`;
  const authDomainsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const steps = [
    {
      step: 1,
      title: 'Install Firebase CLI & Log In',
      desc: 'Ensure you have Node.js installed, then install the official Firebase CLI tool globally and authenticate your Google account in your terminal.',
      command: 'npm install -g firebase-tools\nfirebase login',
      singleLine: 'npm install -g firebase-tools && firebase login',
      tips: 'A browser window will open asking you to sign in with your Google account (use the same account associated with your Firebase project).',
    },
    {
      step: 2,
      title: 'Navigate to Your Project Folder & Link Project',
      desc: 'Important: You must run this command INSIDE the folder where your project files (firebase.json and package.json) are located, not in your user home directory (e.g. C:\\Users\\...). Use "cd" to navigate into the project directory first.',
      command: `cd path/to/your-project-folder\nfirebase use ${projectId}`,
      singleLine: `cd path/to/your-project-folder && firebase use ${projectId}`,
      tips: `Ensure you see firebase.json in the folder (run "dir" on Windows or "ls" on Mac/Linux) before running "firebase use ${projectId}".`,
    },
    {
      step: 3,
      title: 'Build the Production Bundle',
      desc: 'Run the Vite production build to compile React, Tailwind CSS, TypeScript, and asset bundles into the /dist directory.',
      command: 'npm run build',
      singleLine: 'npm run build',
      tips: 'Firebase Hosting serves the static assets compiled into /dist with SPA URL rewrites to index.html.',
    },
    {
      step: 4,
      title: 'Deploy to Firebase Hosting',
      desc: 'Deploy the built bundle to Firebase CDN. Your application will be live immediately with free SSL.',
      command: 'firebase deploy --only hosting',
      singleLine: 'firebase deploy --only hosting',
      tips: 'You can also run "firebase deploy" to deploy both Hosting and Firestore security rules at the same time.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-neutral-100">
                  Deploy to Firebase Hosting
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Free Spark Plan
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Interactive guide to publish your Visual Workflow Canvas to a global CDN with free SSL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Project Context Pill Bar */}
        <div className="px-6 py-3 bg-neutral-950/40 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-neutral-300">
            <div>
              <span className="text-neutral-500 mr-1.5">Project ID:</span>
              <code className="px-1.5 py-0.5 bg-neutral-800 text-amber-300 rounded font-mono">
                {projectId}
              </code>
            </div>
            <div>
              <span className="text-neutral-500 mr-1.5">Live URL:</span>
              <a
                href={hostingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1 font-mono"
              >
                {hostingUrl}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <a
            href={consoleUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Open Firebase Console</span>
          </a>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Download Project ZIP Banner */}
          <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-200 uppercase tracking-wider">
                  ¿No tienes los archivos en tu PC todavía?
                </h4>
                <p className="text-xs text-blue-300/80 leading-relaxed mt-0.5">
                  Descarga el código completo en un archivo <code className="text-blue-100 font-mono">.zip</code> listo para descomprimir en tu computadora y desplegar en 1 minuto.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadZip}
              disabled={downloading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shrink-0 shadow-lg shadow-blue-900/30 cursor-pointer"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preparando (.zip)...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar Proyecto (.zip)</span>
                </>
              )}
            </button>
          </div>

          {/* Recommended Folder Hierarchy */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              <FolderTree className="w-4 h-4 text-amber-400" />
              <span>Jerarquía recomendada en tu computadora</span>
            </div>
            <p className="text-xs text-neutral-400">
              Descomprime el archivo en una ruta limpia y sin espacios en tu disco local (ej. <code className="text-neutral-200 font-mono">C:\Proyectos\visual-workflow-canvas</code>):
            </p>
            <div className="bg-black/70 border border-neutral-800/80 rounded-lg p-3 font-mono text-[11px] text-neutral-300 leading-relaxed overflow-x-auto">
              <div>C:\</div>
              <div>└── <span className="text-amber-400">Proyectos\</span> <span className="text-neutral-500">← Carpeta raíz para tus proyectos de desarrollo</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;└── <span className="text-emerald-400">visual-workflow-canvas\</span> <span className="text-neutral-500">← Descomprime el ZIP aquí</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="text-cyan-300">firebase.json</span> <span className="text-neutral-500">← Configuración de Firebase Hosting</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="text-cyan-300">.firebaserc</span> <span className="text-neutral-500">← Proyecto: massive-artwork-d07pf</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="text-cyan-300">package.json</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="text-cyan-300">firestore.rules</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="text-cyan-300">src\</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── <span className="text-cyan-300">public\</span></div>
            </div>
          </div>

          {/* Quick Summary Banner */}
          <div className="p-4 rounded-lg bg-neutral-800/40 border border-neutral-700/60 flex items-start gap-3">
            <FileCode2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                Archivos de configuración listos en el repositorio
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                <code className="text-neutral-200 font-mono">firebase.json</code> y{' '}
                <code className="text-neutral-200 font-mono">.firebaserc</code> ya están creados con reglas de reescritura SPA para <code className="text-neutral-200 font-mono">dist/</code> y enlaces a <code className="text-neutral-200 font-mono">firestore.rules</code>. No necesitas ejecutar <code className="text-neutral-200 font-mono">firebase init</code>.
              </p>
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-4">
            {steps.map((s) => {
              const isDone = completedSteps[s.step];
              return (
                <div
                  key={s.step}
                  className={`p-4 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : 'bg-neutral-800/30 border-neutral-700/70 hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => toggleStep(s.step)}
                        className="text-neutral-400 hover:text-emerald-400 transition-colors"
                        title={isDone ? 'Mark as incomplete' : 'Mark as done'}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-neutral-500" />
                        )}
                      </button>
                      <span className="font-semibold text-neutral-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-neutral-700/80 text-neutral-200 text-xs flex items-center justify-center font-mono font-bold">
                          {s.step}
                        </span>
                        {s.title}
                      </span>
                    </div>

                    <button
                      onClick={() => copyToClipboard(s.command, `step-${s.step}`)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedKey === `step-${s.step}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Copy command</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-neutral-400 mb-3 ml-7">{s.desc}</p>

                  {/* Terminal Code Snippet */}
                  <div className="ml-7 bg-black/60 border border-neutral-800 rounded-lg p-3 font-mono text-xs text-neutral-200 flex items-center justify-between group">
                    <div className="flex items-center gap-2 overflow-x-auto whitespace-pre">
                      <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-emerald-400 select-none">$</span>
                      <span>{s.command}</span>
                    </div>
                  </div>

                  {s.tips && (
                    <p className="ml-7 mt-2 text-[11px] text-neutral-500 italic">
                      Tip: {s.tips}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick All-in-One Shortcut */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/20 to-neutral-900 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                One-Line Fast Deploy (Once CLI is installed & logged in)
              </span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `npm run build && firebase deploy --only hosting`,
                    'one-liner'
                  )
                }
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 flex items-center gap-1.5 transition-colors"
              >
                {copiedKey === 'one-liner' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All-in-One</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-black/60 border border-neutral-800 rounded-lg p-2.5 font-mono text-xs text-amber-200/90 flex items-center gap-2 overflow-x-auto">
              <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-emerald-400 select-none">$</span>
              <span>npm run build && firebase deploy --only hosting</span>
            </div>
          </div>

          {/* Checklist & Post-Deployment Tips */}
          <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-950/40 space-y-3">
            <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Post-Deployment Verification & Auth Domains
            </h4>
            <div className="space-y-2 text-xs text-neutral-400">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-neutral-200 font-medium">
                    Google Sign-In Domain Whitelist:
                  </span>{' '}
                  Ensure{' '}
                  <code className="text-amber-300 font-mono">
                    {projectId}.web.app
                  </code>
                  ,{' '}
                  <code className="text-amber-300 font-mono">
                    {projectId}.firebaseapp.com
                  </code>
                  , or your <code className="text-amber-300 font-mono">*.vercel.app</code> / custom domain are listed in Firebase Console under{' '}
                  <a
                    href={authDomainsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    Authentication &gt; Settings &gt; Authorized domains
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                  .
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-neutral-200 font-medium">Firebase Storage Enabled:</span>{' '}
                  Image and map uploads go directly to Firebase Storage (<code className="text-neutral-300 font-mono">{projectId}.firebasestorage.app</code>) so static hosting on Firebase Hosting or Vercel works completely serverless. Ensure Storage is activated in Firebase Console with authenticated read/write rules.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-neutral-200 font-medium">Vercel Deployment (Alternative):</span>{' '}
                  <code className="text-neutral-300 font-mono">vercel.json</code> is already configured with SPA rewrites. Run <code className="text-neutral-300 font-mono">vercel --prod</code> (build: <code className="text-neutral-300 font-mono">npm run build</code>, output: <code className="text-neutral-300 font-mono">dist</code>).
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-neutral-200 font-medium">Firestore Security Rules:</span>{' '}
                  Verified Google Auth and RBAC rules (<code className="text-neutral-300 font-mono">Admin</code>, <code className="text-neutral-300 font-mono">Editor</code>, <code className="text-neutral-300 font-mono">Viewer</code>) protect projects, nodes, connections, and user profiles.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Need to update rules as well? Run <code className="text-neutral-200 font-mono">firebase deploy</code></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-xs font-semibold rounded-lg transition-colors border border-neutral-700"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
