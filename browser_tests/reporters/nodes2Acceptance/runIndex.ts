export interface RunPage {
  folder: string
  report: boolean
  gallery: boolean
  builds: string[]
}

export interface RunEntry {
  run: string
  about: string
  pages: RunPage[]
}

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

function pageItem({ folder, report, gallery, builds }: RunPage) {
  const links = [
    ...(report
      ? [`<a href="${escapeHtml(folder)}/report.html">report</a>`]
      : []),
    ...(gallery
      ? [`<a href="${escapeHtml(folder)}/layout.html">layout gallery</a>`]
      : [])
  ]
  const tested = builds.length ? ` · ${escapeHtml(builds.join(', '))}` : ''
  return `<li><b>${escapeHtml(folder)}</b>: ${links.join(' · ')}${tested}</li>`
}

const hasPage = (page: RunPage) => page.report || page.gallery

function runSection({ run, about, pages }: RunEntry) {
  const description = about ? `<p>${escapeHtml(about)}</p>` : ''
  const items = pages.filter(hasPage).map(pageItem).join('')
  return `<h2>${escapeHtml(run)}</h2>${description}<ul>${items}</ul>`
}

/** Renders the index of every acceptance run, newest first, linking each run's reports and layout galleries. */
export function renderRunIndex(runs: RunEntry[]) {
  const sorted = runs
    .filter((entry) => entry.pages.some(hasPage))
    .toSorted((a, b) => b.run.localeCompare(a.run))
  return `<!doctype html><html><head><meta charset="utf-8"><title>Nodes 2.0 acceptance runs</title><style>body{font:12pt sans-serif;margin:24px}li{margin:4px 0}</style></head><body><h1>Nodes 2.0 acceptance runs</h1><p>Each run has its own folder and is never overwritten.</p>${sorted.map(runSection).join('')}</body></html>`
}
