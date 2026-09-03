import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { LOCALE_PREFIXES } from '../config/locales'

const SITE_INDEX_URL = 'https://comfy.org/llms.txt'

export interface SectionSpec {
  /** Route prefix the section covers, without a trailing slash: `/learning`. */
  prefix: string
  title: string
  summary: string
}

interface TwinEntry {
  path: string
  title: string
  description: string
  canonical: string
  body: string
}

function frontMatterValue(front: string, key: string): string {
  const match = new RegExp(`^${key}: (.*)$`, 'm').exec(front)
  if (!match) return ''
  const raw = match[1].trim()
  if (!raw.startsWith('"')) return raw
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'string') return parsed
  } catch {
    // Fall through to the strip-quotes fallback below.
  }
  return raw.replace(/^"|"$/g, '')
}

/** A twin with no usable front matter still gets a stable title: its page path. */
function pageTitle(front: string, path: string): string {
  return frontMatterValue(front, 'title') || path.replace(/\.md$/, '')
}

async function readTwin(
  root: string,
  path: string,
  site: string
): Promise<TwinEntry> {
  const text = await readFile(join(root, path), 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/.exec(text)
  const front = match?.[1] ?? ''
  return {
    path,
    title: pageTitle(front, path),
    description: frontMatterValue(front, 'description'),
    canonical:
      frontMatterValue(front, 'canonical') ||
      new URL(path.replace(/\.md$/, '/').replace(/^\/index\/$/, '/'), site)
        .href,
    body: match?.[2] ?? text
  }
}

function belongsTo(path: string, prefix: string): boolean {
  return path === `${prefix}.md` || path.startsWith(`${prefix}/`)
}

function twinUrl(path: string, site: string): string {
  return new URL(path, site).href
}

/** One llms.txt per section, listing the markdown twins under its prefix. */
function renderSectionIndex(
  section: SectionSpec,
  twins: TwinEntry[],
  site: string
): string {
  const ordered = [...twins].sort((a, b) =>
    a.path === `${section.prefix}.md`
      ? -1
      : b.path === `${section.prefix}.md`
        ? 1
        : a.path.localeCompare(b.path)
  )
  const lines = ordered.map(
    (twin) =>
      `- [${twin.title}](${twinUrl(twin.path, site)}): ${twin.description || twin.title}`
  )
  return [
    `# Comfy: ${section.title}`,
    '',
    `> ${section.summary}`,
    '',
    `Part of the site index at ${SITE_INDEX_URL}. Every link is the markdown twin of a comfy.org page; drop the \`.md\` for the HTML page.`,
    '',
    '## Pages',
    '',
    ...lines,
    ''
  ].join('\n')
}

export async function writeSectionIndexes(
  root: string,
  twinPaths: string[],
  sections: SectionSpec[],
  site = 'https://comfy.org'
): Promise<string[]> {
  const written: string[] = []
  for (const section of sections) {
    const paths = twinPaths.filter((path) => belongsTo(path, section.prefix))
    if (paths.length === 0) continue
    const twins = await Promise.all(
      paths.map((path) => readTwin(root, path, site))
    )
    const target = `${section.prefix}/llms.txt`
    await mkdir(dirname(join(root, target)), { recursive: true })
    await writeFile(
      join(root, target),
      renderSectionIndex(section, twins, site),
      'utf8'
    )
    written.push(target)
  }
  return written
}

/** Every English twin in one file, the way docs and Vercel publish llms-full.txt. */
export async function writeFullText(
  root: string,
  twinPaths: string[],
  site = 'https://comfy.org'
): Promise<string> {
  const english = twinPaths
    .filter(
      (path) =>
        // Every locale, via the same `belongsTo` the section indexes use, which
        // already knows a prefix owns both `/zh-CN.md` and `/zh-CN/...`.
        //
        // This was a literal `!path.startsWith('/zh-CN/')`, which missed two
        // things: every Japanese page once /ja/ existed, and BOTH locales' home
        // pages in every build before that, since a locale home's twin is
        // `/zh-CN.md` rather than `/zh-CN/index.md`. All of them were being
        // concatenated into what is meant to be the English corpus.
        !LOCALE_PREFIXES.some((prefix) => belongsTo(path, prefix)) &&
        path !== '/404.md' &&
        path !== '/p/supported-models.md' &&
        !path.startsWith('/p/supported-models/')
    )
    .sort((a, b) =>
      a === '/index.md' ? -1 : b === '/index.md' ? 1 : a.localeCompare(b)
    )
  const twins = await Promise.all(
    english.map((path) => readTwin(root, path, site))
  )
  const header = [
    '# Comfy: full site text',
    '',
    `> Every English page on comfy.org as markdown, in one file, except the supported-models directory, which has its own catalog at https://comfy.org/p/supported-models/llms.txt. The curated index is ${SITE_INDEX_URL}; each page below starts with its canonical URL.`,
    ''
  ].join('\n')
  const parts = twins.map((twin) => {
    const lines = [`<!-- ${twin.canonical} -->`, `# ${twin.title}`]
    if (twin.description) lines.push('', `> ${twin.description}`)
    lines.push('', twin.body.replace(/^# .*\n\n?/, '').trim())
    return lines.join('\n')
  })
  const target = '/llms-full.txt'
  await writeFile(
    join(root, target),
    `${header}\n${parts.join('\n\n---\n\n')}\n`,
    'utf8'
  )
  return target
}
