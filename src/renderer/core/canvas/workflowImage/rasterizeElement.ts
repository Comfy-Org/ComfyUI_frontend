import type {
  HasBoundingRect,
  RectTuple
} from '@comfyorg/shared-frontend-utils/geometry'

import { createBounds } from '@/lib/litegraph/src/measure'
import { parseUrl } from '@comfyorg/shared-frontend-utils/urlSafety'

const XHTML_NS = 'http://www.w3.org/1999/xhtml'
const SVG_NS = 'http://www.w3.org/2000/svg'
const REPLACED_ELEMENTS = 'img, video, canvas, iframe'

interface RasterizeOptions {
  padding: number
  pixelRatio: number
}

export interface PositionedElement {
  element: HTMLElement
  x: number
  y: number
  width: number
  height: number
}

type ImageLoad =
  | { ok: true; image: HTMLImageElement }
  | { ok: false; cause?: unknown }

type RasterizedElement =
  | { ok: true; image: HTMLImageElement; bounds: RectTuple }
  | Extract<ImageLoad, { ok: false }>

function readableRules(sheet: CSSStyleSheet): CSSRule[] {
  try {
    return [...sheet.cssRules]
  } catch {
    return []
  }
}

function serializeRules(rules: Iterable<CSSRule>): string {
  let css = ''
  for (const rule of rules) css += serializeRule(rule)
  return css
}

function serializeRule(rule: CSSRule): string {
  if (rule instanceof CSSFontFaceRule) return ''
  if (rule instanceof CSSMediaRule)
    return matchMedia(rule.conditionText).matches
      ? serializeRules(rule.cssRules)
      : ''
  if (rule instanceof CSSImportRule)
    return rule.styleSheet ? serializeRules(readableRules(rule.styleSheet)) : ''
  if (rule instanceof CSSStyleRule)
    return `${rule.selectorText}{${rule.style.cssText}${serializeRules(rule.cssRules)}}`
  if (rule instanceof CSSGroupingRule)
    return `${rule.cssText.slice(0, rule.cssText.indexOf('{'))}{${serializeRules(rule.cssRules)}}`
  return rule.cssText
}

function* flattenRules(rules: Iterable<CSSRule>): Generator<CSSRule> {
  for (const rule of rules) {
    yield rule
    if (rule instanceof CSSGroupingRule) yield* flattenRules(rule.cssRules)
    if (rule instanceof CSSImportRule && rule.styleSheet)
      yield* flattenRules(readableRules(rule.styleSheet))
  }
}

async function toDataUrl(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url)
    if (!response.ok) return undefined
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : undefined)
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

function unquote(family: string): string {
  return family.trim().replace(/^["']|["']$/g, '')
}

async function embedFontFace(
  rule: CSSFontFaceRule,
  base: string
): Promise<string> {
  let text = rule.cssText
  for (const [match, , url] of text.matchAll(/url\((["']?)([^"')]+)\1\)/g)) {
    if (url.startsWith('data:')) continue
    const href = parseUrl(url, base)?.href
    const dataUrl = href && (await toDataUrl(href))
    if (dataUrl) text = text.replace(match, `url("${dataUrl}")`)
  }
  return text
}

async function embeddedFontFaces(sheets: CSSStyleSheet[]): Promise<string> {
  const loadedFamilies = new Set(
    [...document.fonts]
      .filter(({ status }) => status === 'loaded')
      .map(({ family }) => unquote(family))
  )
  const faces = sheets.flatMap((sheet) =>
    [...flattenRules(readableRules(sheet))]
      .filter((rule) => rule instanceof CSSFontFaceRule)
      .filter((rule) =>
        loadedFamilies.has(unquote(rule.style.getPropertyValue('font-family')))
      )
      .map((rule) => embedFontFace(rule, sheet.href ?? document.baseURI))
  )
  return (await Promise.all(faces)).join('')
}

async function collectStyles(): Promise<string> {
  const sheets = [...document.styleSheets, ...document.adoptedStyleSheets]
  const css = sheets
    .map((sheet) => serializeRules(readableRules(sheet)))
    .join('')
  return (await embeddedFontFaces(sheets)) + css
}

function ancestorShells(inert: Document, element: Element) {
  const chain: Element[] = []
  for (
    let ancestor = element.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  )
    chain.unshift(ancestor)

  if (chain.length === 0) chain.push(inert.createElementNS(XHTML_NS, 'div'))
  const shells = chain.map((ancestor) => {
    const shell = inert.createElementNS(XHTML_NS, ancestor.localName)
    for (const { name, value } of ancestor.attributes)
      shell.setAttribute(name, value)
    shell.setAttribute(
      'style',
      `${ancestor.getAttribute('style') ?? ''};display:contents;visibility:visible;clip-path:none`
    )
    return shell
  })
  shells.reduce((parent, shell) => {
    parent.append(shell)
    return shell
  })
  return { outermost: shells[0], innermost: shells[shells.length - 1] }
}

function copyFormState(source: Element, clone: Element) {
  const sources = [source, ...source.querySelectorAll('textarea, input')]
  const clones = [clone, ...clone.querySelectorAll('textarea, input')]
  for (const [index, field] of sources.entries()) {
    const target = clones[index]
    if (field instanceof HTMLTextAreaElement) target.textContent = field.value
    else if (field instanceof HTMLInputElement) {
      if (field.type === 'checkbox' || field.type === 'radio')
        target.toggleAttribute('checked', field.checked)
      else target.setAttribute('value', field.value)
    }
  }
}

function hideReplacedElements(clone: Element) {
  const elements = [...clone.querySelectorAll(REPLACED_ELEMENTS)]
  if (clone.matches(REPLACED_ELEMENTS)) elements.unshift(clone)
  for (const element of elements)
    element.setAttribute(
      'style',
      `${element.getAttribute('style') ?? ''};visibility:hidden`
    )
}

async function loadSvgWithEmbeddedFonts(src: string): Promise<ImageLoad> {
  const image = new Image()
  image.src = src
  try {
    await image.decode()
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')
    if (!ctx) return { ok: false }
    ctx.drawImage(image, 0, 0)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    return { ok: true, image }
  } catch (cause) {
    return { ok: false, cause }
  }
}

function paddedBounds(elements: readonly PositionedElement[], padding: number) {
  const bounds = createBounds(
    elements.map<HasBoundingRect>(({ x, y, width, height }) => ({
      boundingRect: [x, y, width, height]
    })),
    padding
  )
  if (!bounds) return undefined
  const [left, top, width, height] = bounds
  if (!(width > 0 && height > 0)) return undefined
  return { left, top, width, height }
}

function toSvgMarkup(
  inert: Document,
  content: Element,
  width: number,
  height: number,
  pixelRatio: number
): string {
  const svg = inert.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', String(width * pixelRatio))
  svg.setAttribute('height', String(height * pixelRatio))
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  const foreignObject = inert.createElementNS(SVG_NS, 'foreignObject')
  foreignObject.setAttribute('width', '100%')
  foreignObject.setAttribute('height', '100%')
  foreignObject.append(content)
  svg.append(foreignObject)
  return new XMLSerializer().serializeToString(svg)
}

export function createElementRasterizer() {
  const inert = document.implementation.createHTMLDocument()
  const styles = collectStyles()

  async function rasterize(
    elements: readonly PositionedElement[],
    { padding, pixelRatio }: RasterizeOptions
  ): Promise<RasterizedElement> {
    const bounds = paddedBounds(elements, padding)
    if (!bounds) return { ok: false }
    const { left, top, width, height } = bounds

    try {
      const shells = ancestorShells(inert, elements[0].element)
      for (const positioned of elements) {
        const { element, x, y } = positioned
        const clone = inert.importNode(element, true)
        if (!(clone instanceof HTMLElement)) return { ok: false }
        copyFormState(element, clone)
        clone.style.removeProperty('display')
        clone.style.setProperty('position', 'absolute')
        clone.style.setProperty('left', '0')
        clone.style.setProperty('top', '0')
        clone.style.setProperty('visibility', 'visible')
        clone.style.setProperty('clip-path', 'none')
        clone.style.setProperty('width', `${positioned.width}px`)
        clone.style.setProperty('height', `${positioned.height}px`)
        hideReplacedElements(clone)
        clone.style.setProperty(
          'transform',
          `translate(${x - left}px, ${y - top}px)`
        )
        shells.innermost.append(clone)
      }

      const container = inert.createElementNS(XHTML_NS, 'div')
      container.setAttribute(
        'style',
        `position:relative;width:${width}px;height:${height}px;overflow:hidden;`
      )
      const style = inert.createElementNS(XHTML_NS, 'style')
      style.textContent = await styles
      container.append(style, shells.outermost)

      const markup = toSvgMarkup(inert, container, width, height, pixelRatio)
      const loaded = await loadSvgWithEmbeddedFonts(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
      )
      return loaded.ok
        ? { ...loaded, bounds: [left, top, width, height] }
        : loaded
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  return { rasterize }
}
