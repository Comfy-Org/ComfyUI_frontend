import { Window } from 'happy-dom'
import type { Document, Element, Node } from 'happy-dom'

const SITE_INDEX_URL = 'https://comfy.org/llms.txt'

export interface TwinPage {
  title: string
  description: string
  lang: string
  canonical: string
  body: string
}

/** Elements that never carry page content worth handing to an agent. */
const DROPPED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'VIDEO',
  'AUDIO',
  'IFRAME',
  'CANVAS',
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'FORM',
  'NAV',
  'FOOTER',
  'HEADER',
  'DIALOG',
  'SOURCE',
  'TRACK'
])

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'DD',
  'DETAILS',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'MAIN',
  'P',
  'SECTION',
  'SUMMARY',
  'ASTRO-ISLAND',
  'ASTRO-SLOT'
])

const TEXT_NODE = 3
const ELEMENT_NODE = 1

interface Context {
  base: string
  seenImages: Set<string>
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ')
}

function absolute(href: string, base: string): string | undefined {
  try {
    const url = new URL(href, base)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

/** SVG and MathML elements keep lowercase tag names inside HTML documents. */
function tag(element: Element): string {
  return element.tagName.toUpperCase()
}

function isDropped(element: Element): boolean {
  return (
    DROPPED_TAGS.has(tag(element)) ||
    element.getAttribute('aria-hidden') === 'true'
  )
}

function children(node: Node): Node[] {
  return Array.from(node.childNodes)
}

/** Adjacent inline elements (pills, badges, CTAs) get the space their layout implies. */
function appendInline(run: string, child: Node, ctx: Context): string {
  const chunk = inline(child, ctx)
  const needsSpace =
    child.nodeType === ELEMENT_NODE &&
    run.length > 0 &&
    chunk.length > 0 &&
    !/\s$/.test(run) &&
    !/^\s/.test(chunk)
  return needsSpace ? `${run} ${chunk}` : run + chunk
}

function joinInline(nodes: Node[], ctx: Context): string {
  return nodes.reduce((run, child) => appendInline(run, child, ctx), '')
}

function inline(node: Node, ctx: Context): string {
  if (node.nodeType === TEXT_NODE) return collapse(node.textContent ?? '')
  if (node.nodeType !== ELEMENT_NODE) return ''
  const element = node as Element
  if (isDropped(element)) return ''
  const inner = () => joinInline(children(element), ctx)
  switch (tag(element)) {
    case 'BR':
      return '\n'
    case 'A': {
      const text = inner().trim()
      const href = element.getAttribute('href') ?? ''
      const url = href.startsWith('#') ? undefined : absolute(href, ctx.base)
      return url && text ? `[${text}](${url})` : text
    }
    case 'IMG': {
      const alt = collapse(element.getAttribute('alt') ?? '').trim()
      const src = absolute(element.getAttribute('src') ?? '', ctx.base)
      if (!alt || !src || src.endsWith('.svg') || ctx.seenImages.has(src))
        return ''
      ctx.seenImages.add(src)
      return `![${alt}](${src})`
    }
    case 'STRONG':
    case 'B': {
      const text = inner().trim()
      return text ? `**${text}**` : ''
    }
    case 'EM':
    case 'I': {
      const text = inner().trim()
      return text ? `*${text}*` : ''
    }
    case 'CODE': {
      const text = element.textContent?.trim() ?? ''
      return text ? `\`${text}\`` : ''
    }
    default:
      return BLOCK_TAGS.has(tag(element)) || tag(element) === 'LI'
        ? `\n\n${block(element, ctx)}\n\n`
        : inner()
  }
}

function list(element: Element, ctx: Context, ordered: boolean): string {
  const items = children(element).filter(
    (child) => child.nodeType === ELEMENT_NODE && tag(child as Element) === 'LI'
  )
  return items
    .map((item, index) => {
      const marker = ordered ? `${index + 1}. ` : '- '
      const lines = block(item as Element, ctx).split('\n')
      return lines
        .map((line, lineIndex) =>
          lineIndex === 0 ? `${marker}${line}` : `  ${line}`
        )
        .join('\n')
    })
    .join('\n')
}

function table(element: Element, ctx: Context): string {
  const rows = Array.from(element.querySelectorAll('tr')).map((row) =>
    Array.from(row.children).map((cell) =>
      inline(cell, ctx).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim()
    )
  )
  if (rows.length === 0) return ''
  const width = Math.max(...rows.map((row) => row.length))
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`
  const [head, ...rest] = rows
  return [
    line(head),
    `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
    ...rest.map(line)
  ].join('\n')
}

function block(element: Element, ctx: Context): string {
  if (isDropped(element)) return ''
  switch (tag(element)) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const text = collapse(inlineChildren(element, ctx)).trim()
      return text ? `${'#'.repeat(Number(tag(element)[1]))} ${text}` : ''
    }
    case 'UL':
      return list(element, ctx, false)
    case 'OL':
      return list(element, ctx, true)
    case 'PRE':
      return `\`\`\`\n${(element.textContent ?? '').replace(/\s+$/, '')}\n\`\`\``
    case 'TABLE':
      return table(element, ctx)
    case 'BLOCKQUOTE':
      return blocks(element, ctx)
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
    case 'HR':
      return '---'
    case 'DT': {
      const text = inlineChildren(element, ctx).trim()
      return text ? `**${text}**` : ''
    }
    default:
      return blocks(element, ctx)
  }
}

function inlineChildren(element: Element, ctx: Context): string {
  return joinInline(children(element), ctx)
}

/** Serialise mixed content: inline runs become paragraphs, block children stay blocks. */
function blocks(element: Element, ctx: Context): string {
  const parts: string[] = []
  let run = ''
  const flush = () => {
    const text = run.replace(/[ \t]+\n/g, '\n').trim()
    if (text) parts.push(text)
    run = ''
  }
  for (const child of children(element)) {
    const isBlock =
      child.nodeType === ELEMENT_NODE &&
      (BLOCK_TAGS.has(tag(child as Element)) ||
        /^(H[1-6]|UL|OL|PRE|TABLE|BLOCKQUOTE|HR|DT)$/.test(
          tag(child as Element)
        ))
    if (isBlock) {
      flush()
      const rendered = block(child as Element, ctx)
      if (rendered) parts.push(rendered)
    } else {
      run = appendInline(run, child, ctx)
    }
  }
  flush()
  return parts.join('\n\n')
}

function tidy(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function meta(document: Document, name: string): string {
  return collapse(
    document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ??
      ''
  ).trim()
}

/** Extract the page's main content as markdown, with absolute links. */
export function htmlToTwin(html: string, fallbackCanonical: string): TwinPage {
  const window = new Window({
    settings: {
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true
    }
  })
  try {
    const document = new window.DOMParser().parseFromString(html, 'text/html')
    const canonical =
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') ??
      fallbackCanonical
    const ctx: Context = { base: canonical, seenImages: new Set() }
    const root = document.querySelector('main') ?? document.body
    return {
      title: collapse(document.title).trim(),
      description: meta(document, 'description'),
      lang: document.documentElement.getAttribute('lang') ?? 'en',
      canonical,
      body: tidy(blocks(root, ctx))
    }
  } finally {
    void window.happyDOM.close()
  }
}

/** The twin file: YAML front matter agents and tools both read, then the content. */
export function renderTwin(page: TwinPage): string {
  const front = [
    `title: ${JSON.stringify(page.title)}`,
    `description: ${JSON.stringify(page.description)}`,
    `canonical: ${page.canonical}`,
    `lang: ${page.lang}`,
    `index: ${SITE_INDEX_URL}`
  ]
  return `---\n${front.join('\n')}\n---\n\n${page.body}\n`
}
