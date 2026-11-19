import { ActorItem, AppState, WorkflowNode } from '../types/workflow';
import { isFirestoreMediaUrl, resolveMediaUrl } from '../services/mediaCache';

export type ReportFormat = 'html' | 'csv' | 'json';

export interface ProjectReportLabels {
  reportTitle: string;
  generatedAt: string;
  filteredTagNote: string;
  statScenes: string;
  statActors: string;
  statTags: string;
  statAssignments: string;
  sectionTagMatrix: string;
  sectionActorCatalog: string;
  sectionSceneBreakdown: string;
  colTag: string;
  colActorsCount: string;
  colScenesCount: string;
  colActor: string;
  colCategory: string;
  colStates: string;
  colTags: string;
  colAppearances: string;
  colScene: string;
  colActorsStates: string;
  colFocus: string;
  colAction: string;
  colDescription: string;
  noDescription: string;
  noneLabel: string;
  removedActor: string;
}

export interface ReportTagRow {
  tag: string;
  actorNames: string[];
  sceneTitles: string[];
}

export interface ReportActorAppearance {
  nodeId: string;
  sceneTitle: string;
  stateLabel: string;
  stateColor: string;
}

export interface ReportActorRow {
  actor: ActorItem;
  appearances: ReportActorAppearance[];
}

export interface ReportSceneActorEntry {
  assignmentId: string;
  actorId: string;
  actorName: string;
  thumbnailUrl: string | null;
  tags: string[];
  stateLabel: string;
  stateColor: string;
  isMissing: boolean;
}

export interface ReportSceneRow {
  node: WorkflowNode;
  actors: ReportSceneActorEntry[];
}

export interface GlobalProjectReportData {
  projectTitle: string;
  generatedAtIso: string;
  selectedTag: string;
  allTags: string[];
  tagMatrix: ReportTagRow[];
  actorRows: ReportActorRow[];
  sceneRows: ReportSceneRow[];
  totalAssignments: number;
}

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCsv(val: string): string {
  const s = String(val ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildGlobalProjectReport(params: {
  appState: AppState;
  projectTitle: string;
  selectedTag: string;
  labels: ProjectReportLabels;
}): GlobalProjectReportData {
  const { appState, projectTitle, selectedTag, labels } = params;
  const allActors = appState.actors || [];
  const actorsById = new Map<string, ActorItem>(allActors.map((a) => [a.id, a]));
  const allNodes = Object.values(appState.nodes).sort((a, b) =>
    (a.title || '').localeCompare(b.title || '')
  );

  // Collect all unique tags across all project actors
  const tagMap = new Map<string, { actorNames: Set<string>; sceneTitles: Set<string> }>();
  allActors.forEach((actor) => {
    (actor.tags || []).forEach((tg) => {
      const clean = tg.trim();
      if (!clean) return;
      if (!tagMap.has(clean)) {
        tagMap.set(clean, { actorNames: new Set(), sceneTitles: new Set() });
      }
      tagMap.get(clean)!.actorNames.add(actor.name);
    });
  });

  allNodes.forEach((node) => {
    (node.actors || []).forEach((assign) => {
      const actor = actorsById.get(assign.actorId);
      if (!actor) return;
      (actor.tags || []).forEach((tg) => {
        const clean = tg.trim();
        if (clean && tagMap.has(clean)) {
          tagMap.get(clean)!.sceneTitles.add(node.title || node.id);
        }
      });
    });
  });

  const allTags = Array.from(tagMap.keys()).sort((a, b) => a.localeCompare(b));

  const filteredActors =
    selectedTag === 'all'
      ? allActors
      : allActors.filter((a) => (a.tags || []).includes(selectedTag));

  const filteredActorIdSet = new Set(filteredActors.map((a) => a.id));

  const actorRows: ReportActorRow[] = filteredActors.map((actor) => {
    const appearances: ReportActorAppearance[] = [];
    allNodes.forEach((node) => {
      (node.actors || []).forEach((assign) => {
        if (assign.actorId === actor.id) {
          const liveState = actor.states.find((s) => s.id === assign.stateId);
          appearances.push({
            nodeId: node.id,
            sceneTitle: node.title || node.id,
            stateLabel: liveState?.label || assign.stateLabel || labels.noneLabel,
            stateColor: liveState?.color || '#3b82f6',
          });
        }
      });
    });
    return { actor, appearances };
  });

  let totalAssignments = 0;
  const sceneRows: ReportSceneRow[] = allNodes
    .map((node) => {
      const resolvedActors: ReportSceneActorEntry[] = (node.actors || [])
        .filter((assign) => selectedTag === 'all' || filteredActorIdSet.has(assign.actorId))
        .map((assign) => {
          const actor = actorsById.get(assign.actorId);
          if (!actor) {
            return {
              assignmentId: assign.id,
              actorId: assign.actorId,
              actorName: labels.removedActor,
              thumbnailUrl: null,
              tags: [],
              stateLabel: assign.stateLabel || labels.noneLabel,
              stateColor: '#64748b',
              isMissing: true,
            };
          }
          const liveState = actor.states.find((s) => s.id === assign.stateId);
          return {
            assignmentId: assign.id,
            actorId: actor.id,
            actorName: actor.name,
            thumbnailUrl: actor.thumbnailUrl || null,
            tags: actor.tags || [],
            stateLabel: liveState?.label || assign.stateLabel || labels.noneLabel,
            stateColor: liveState?.color || '#3b82f6',
            isMissing: false,
          };
        });

      totalAssignments += resolvedActors.length;
      return {
        node,
        actors: resolvedActors,
      };
    })
    .filter((row) => selectedTag === 'all' || row.actors.length > 0);

  const tagMatrix: ReportTagRow[] = allTags
    .filter((tg) => selectedTag === 'all' || tg === selectedTag)
    .map((tag) => {
      const entry = tagMap.get(tag)!;
      return {
        tag,
        actorNames: Array.from(entry.actorNames),
        sceneTitles: Array.from(entry.sceneTitles),
      };
    });

  return {
    projectTitle,
    generatedAtIso: new Date().toISOString(),
    selectedTag,
    allTags,
    tagMatrix,
    actorRows,
    sceneRows,
    totalAssignments,
  };
}

export async function exportProjectReportToFile(params: {
  report: GlobalProjectReportData;
  format: ReportFormat;
  includeTagMatrix: boolean;
  includeActorCatalog: boolean;
  includeSceneBreakdown: boolean;
  locale: string;
  labels: ProjectReportLabels;
}) {
  const {
    report: rawReport,
    format,
    includeTagMatrix,
    includeActorCatalog,
    includeSceneBreakdown,
    locale,
    labels,
  } = params;

  const resolvedThumbMap = new Map<string, string>();
  const thumbCandidates = Array.from(
    new Set(
      rawReport.actorRows
        .map((r) => r.actor.thumbnailUrl)
        .filter((u): u is string => isFirestoreMediaUrl(u))
    )
  );
  if (thumbCandidates.length > 0) {
    await Promise.all(
      thumbCandidates.map(async (u) => {
        const dataUrl = await resolveMediaUrl(u);
        if (dataUrl) resolvedThumbMap.set(u, dataUrl);
      })
    );
  }

  const report: GlobalProjectReportData =
    resolvedThumbMap.size === 0
      ? rawReport
      : {
          ...rawReport,
          actorRows: rawReport.actorRows.map((row) => ({
            ...row,
            actor: {
              ...row.actor,
              thumbnailUrl:
                (row.actor.thumbnailUrl && resolvedThumbMap.get(row.actor.thumbnailUrl)) ||
                row.actor.thumbnailUrl,
            },
          })),
          sceneRows: rawReport.sceneRows.map((s) => ({
            ...s,
            actors: s.actors.map((a) => ({
              ...a,
              thumbnailUrl:
                (a.thumbnailUrl && resolvedThumbMap.get(a.thumbnailUrl)) || a.thumbnailUrl,
            })),
          })),
        };

  const safeTitle = (report.projectTitle || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
  const dateStamp = new Date().toISOString().slice(0, 10);
  const formattedDate = new Date(report.generatedAtIso).toLocaleString(locale);

  let content = '';
  let mimeType = 'text/plain;charset=utf-8';
  let ext: string = format;

  if (format === 'json') {
    const payload = {
      projectTitle: report.projectTitle,
      generatedAt: report.generatedAtIso,
      selectedTag: report.selectedTag,
      summary: {
        activeScenes: report.sceneRows.length,
        actors: report.actorRows.length,
        uniqueTags: report.tagMatrix.length,
        sceneAssignments: report.totalAssignments,
      },
      ...(includeTagMatrix ? { tagMatrix: report.tagMatrix } : {}),
      ...(includeActorCatalog
        ? {
            actors: report.actorRows.map((r) => ({
              id: r.actor.id,
              name: r.actor.name,
              category: r.actor.category,
              description: r.actor.description,
              thumbnailUrl: r.actor.thumbnailUrl,
              states: r.actor.states,
              tags: r.actor.tags,
              appearances: r.appearances,
            })),
          }
        : {}),
      ...(includeSceneBreakdown
        ? {
            scenes: report.sceneRows.map((s) => ({
              id: s.node.id,
              title: s.node.title,
              enfoque: s.node.enfoque,
              accion: s.node.accion,
              descripcion: s.node.descripcion,
              actors: s.actors,
            })),
          }
        : {}),
    };
    content = JSON.stringify(payload, null, 2);
    mimeType = 'application/json;charset=utf-8';
  } else if (format === 'csv') {
    const lines: string[] = [];
    if (includeSceneBreakdown) {
      lines.push(
        [
          labels.colScene,
          labels.colActor,
          labels.colStates,
          labels.colTags,
          labels.colFocus,
          labels.colAction,
          labels.colDescription,
        ]
          .map(escapeCsv)
          .join(',')
      );
      report.sceneRows.forEach((s) => {
        if (s.actors.length === 0) {
          lines.push(
            [
              s.node.title || s.node.id,
              labels.noneLabel,
              '',
              '',
              s.node.enfoque || '',
              s.node.accion || '',
              s.node.descripcion || '',
            ]
              .map(escapeCsv)
              .join(',')
          );
        } else {
          s.actors.forEach((a) => {
            lines.push(
              [
                s.node.title || s.node.id,
                a.actorName,
                a.stateLabel,
                a.tags.map((t) => `#${t}`).join(' '),
                s.node.enfoque || '',
                s.node.accion || '',
                s.node.descripcion || '',
              ]
                .map(escapeCsv)
                .join(',')
            );
          });
        }
      });
    }
    if (includeActorCatalog) {
      if (lines.length > 0) lines.push('');
      lines.push(
        [
          labels.colActor,
          labels.colCategory,
          labels.colStates,
          labels.colTags,
          labels.colAppearances,
        ]
          .map(escapeCsv)
          .join(',')
      );
      report.actorRows.forEach((r) => {
        lines.push(
          [
            r.actor.name,
            r.actor.category || '',
            r.actor.states.map((st) => st.label).join(' | '),
            r.actor.tags.map((tg) => `#${tg}`).join(' '),
            r.appearances.map((ap) => `${ap.sceneTitle} (${ap.stateLabel})`).join(' | '),
          ]
            .map(escapeCsv)
            .join(',')
        );
      });
    }
    content = '\uFEFF' + lines.join('\n');
    mimeType = 'text/csv;charset=utf-8';
  } else {
    // Self-contained printable HTML
    const tagRowsHtml = report.tagMatrix
      .map(
        (tRow) => `
          <tr>
            <td style="font-family:monospace;font-weight:600;">#${escapeHtml(tRow.tag)}</td>
            <td>${escapeHtml(tRow.actorNames.join(', ') || labels.noneLabel)}</td>
            <td>${escapeHtml(tRow.sceneTitles.join(', ') || labels.noneLabel)}</td>
          </tr>`
      )
      .join('');

    const actorRowsHtml = report.actorRows
      .map(
        (r) => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                ${
                  r.actor.thumbnailUrl
                    ? `<img src="${escapeHtml(r.actor.thumbnailUrl)}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid #d4cfc3;" />`
                    : `<div style="width:44px;height:44px;border-radius:6px;background:#e5e2d9;border:1px solid #d4cfc3;"></div>`
                }
                <div>
                  <div style="font-weight:700;">${escapeHtml(r.actor.name)}</div>
                  <div style="font-size:11px;color:#5c584e;">${escapeHtml(r.actor.category || '')}</div>
                  ${
                    r.actor.description
                      ? `<div style="font-size:11px;color:#4a463d;margin-top:3px;">${escapeHtml(r.actor.description)}</div>`
                      : ''
                  }
                </div>
              </div>
            </td>
            <td>${r.actor.states
              .map(
                (st) =>
                  `<div style="display:inline-flex;align-items:center;gap:5px;margin-right:10px;font-size:12px;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${escapeHtml(
                    st.color || '#3b82f6'
                  )};"></span>${escapeHtml(st.label)}</div>`
              )
              .join('')}</td>
            <td style="font-family:monospace;font-size:11px;">${escapeHtml(
              r.actor.tags.map((tg) => `#${tg}`).join(' · ') || labels.noneLabel
            )}</td>
            <td style="font-size:12px;">${
              r.appearances.length > 0
                ? r.appearances
                    .map(
                      (ap) =>
                        `<div><strong>${escapeHtml(ap.sceneTitle)}</strong>: ${escapeHtml(
                          ap.stateLabel
                        )}</div>`
                    )
                    .join('')
                : `<span style="color:#757065;">${escapeHtml(labels.noneLabel)}</span>`
            }</td>
          </tr>`
      )
      .join('');

    const sceneRowsHtml = report.sceneRows
      .map(
        (s) => `
          <tr>
            <td style="font-weight:700;vertical-align:top;">${escapeHtml(
              s.node.title || s.node.id
            )}</td>
            <td style="vertical-align:top;">${
              s.actors.length > 0
                ? s.actors
                    .map(
                      (a) =>
                        `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${escapeHtml(
                            a.stateColor
                          )};"></span>
                          <span><strong>${escapeHtml(a.actorName)}</strong> — ${escapeHtml(
                            a.stateLabel
                          )}</span>
                        </div>`
                    )
                    .join('')
                : `<span style="color:#757065;">${escapeHtml(labels.noneLabel)}</span>`
            }</td>
            <td style="vertical-align:top;font-size:12px;color:#333029;">
              <div><strong>${escapeHtml(labels.colFocus)}:</strong> ${escapeHtml(
                s.node.enfoque || labels.noDescription
              )}</div>
              <div style="margin-top:4px;"><strong>${escapeHtml(labels.colAction)}:</strong> ${escapeHtml(
                s.node.accion || labels.noDescription
              )}</div>
              <div style="margin-top:4px;"><strong>${escapeHtml(
                labels.colDescription
              )}:</strong> ${escapeHtml(s.node.descripcion || labels.noDescription)}</div>
            </td>
          </tr>`
      )
      .join('');

    content = `<!doctype html>
<html lang="${escapeHtml(locale.slice(0, 2))}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(report.projectTitle)} — ${escapeHtml(labels.reportTitle)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #1f1d18; background: #ffffff; margin: 32px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 10px; border-bottom: 1px solid #d4cfc3; padding-bottom: 6px; }
  .meta { color: #5c584e; font-size: 12px; margin-bottom: 18px; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat { border: 1px solid #d4cfc3; border-radius: 8px; padding: 10px 12px; background: #faf8f4; }
  .stat-val { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat-lbl { font-size: 11px; color: #5c584e; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px; }
  th, td { border: 1px solid #d4cfc3; padding: 8px 10px; text-align: left; }
  th { background: #f3efe6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #4a463d; }
  @media print { body { margin: 16px; } }
</style>
</head>
<body>
  <h1>${escapeHtml(report.projectTitle)} · ${escapeHtml(labels.reportTitle)}</h1>
  <div class="meta">
    ${escapeHtml(labels.generatedAt.replace('{date}', formattedDate))}
    ${
      report.selectedTag !== 'all'
        ? ` · ${escapeHtml(labels.filteredTagNote.replace('{tag}', `#${report.selectedTag}`))}`
        : ''
    }
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-val">${report.sceneRows.length}</div><div class="stat-lbl">${escapeHtml(labels.statScenes)}</div></div>
    <div class="stat"><div class="stat-val">${report.actorRows.length}</div><div class="stat-lbl">${escapeHtml(labels.statActors)}</div></div>
    <div class="stat"><div class="stat-val">${report.tagMatrix.length}</div><div class="stat-lbl">${escapeHtml(labels.statTags)}</div></div>
    <div class="stat"><div class="stat-val">${report.totalAssignments}</div><div class="stat-lbl">${escapeHtml(labels.statAssignments)}</div></div>
  </div>
  ${
    includeTagMatrix
      ? `<h2>${escapeHtml(labels.sectionTagMatrix)}</h2>
         <table><thead><tr><th>${escapeHtml(labels.colTag)}</th><th>${escapeHtml(
           labels.colActorsCount
         )}</th><th>${escapeHtml(labels.colScenesCount)}</th></tr></thead><tbody>${tagRowsHtml}</tbody></table>`
      : ''
  }
  ${
    includeActorCatalog
      ? `<h2>${escapeHtml(labels.sectionActorCatalog)}</h2>
         <table><thead><tr><th>${escapeHtml(labels.colActor)}</th><th>${escapeHtml(
           labels.colStates
         )}</th><th>${escapeHtml(labels.colTags)}</th><th>${escapeHtml(
           labels.colAppearances
         )}</th></tr></thead><tbody>${actorRowsHtml}</tbody></table>`
      : ''
  }
  ${
    includeSceneBreakdown
      ? `<h2>${escapeHtml(labels.sectionSceneBreakdown)}</h2>
         <table><thead><tr><th>${escapeHtml(labels.colScene)}</th><th>${escapeHtml(
           labels.colActorsStates
         )}</th><th>${escapeHtml(labels.colFocus)} / ${escapeHtml(labels.colAction)} / ${escapeHtml(
           labels.colDescription
         )}</th></tr></thead><tbody>${sceneRowsHtml}</tbody></table>`
      : ''
  }
</body>
</html>`;
    mimeType = 'text/html;charset=utf-8';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}-report-${dateStamp}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
