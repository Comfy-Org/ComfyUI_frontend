const XHTML_NS = 'http://www.w3.org/1999/xhtml'
const SVG_NS = 'http://www.w3.org/2000/svg'
const REPLACED_ELEMENTS = 'img, video, canvas, iframe'

interface RasterizeOptions {
  padding: number
  pixelRatio: number
  prepareClone?: (clone: HTMLElement, source: HTMLElement) => Promise<void>
}

interface PositionedElement {
  element: HTMLElement
  x: number
  y: number
}

function serializeRules(rules: CSSRuleList): string {
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
    return rule.styleSheet ? serializeRules(rule.styleSheet.cssRules) : ''
  if (rule instanceof CSSStyleRule)
    return `${rule.selectorText}{${rule.style.cssText}${serializeRules(rule.cssRules)}}`
  if (rule instanceof CSSGroupingRule)
    return `${rule.cssText.slice(0, rule.cssText.indexOf('{'))}{${serializeRules(rule.cssRules)}}`
  return rule.cssText
}

function* flattenRules(rules: CSSRuleList): Generator<CSSRule> {
  for (const rule of rules) {
    yield rule
    if (rule instanceof CSSGroupingRule) yield* flattenRules(rule.cssRules)
    if (rule instanceof CSSImportRule && rule.styleSheet)
      yield* flattenRules(rule.styleSheet.cssRules)
  }
}

function readableSheets(): CSSStyleSheet[] {
  return [...document.styleSheets, ...document.adoptedStyleSheets].filter(
    (sheet) => {
      try {
        return sheet.cssRules.length >= 0
      } catch {
        return false
      }
    }
  )
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
    const dataUrl = await toDataUrl(new URL(url, base).href)
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
    [...flattenRules(sheet.cssRules)]
      .filter((rule) => rule instanceof CSSFontFaceRule)
      .filter((rule) =>
        loadedFamilies.has(unquote(rule.style.getPropertyValue('font-family')))
      )
      .map((rule) => embedFontFace(rule, sheet.href ?? document.baseURI))
  )
  return (await Promise.all(faces)).join('')
}

async function collectStyles(): Promise<string> {
  const sheets = readableSheets()
  const css = sheets.map((sheet) => serializeRules(sheet.cssRules)).join('')
  return (await embeddedFontFaces(sheets)) + css
}

function ancestorShells(element: Element) {
  const chain: Element[] = []
  for (
    let ancestor = element.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  )
    chain.unshift(ancestor)

  const shells = chain.map((ancestor) => {
    const shell = document.createElementNS(XHTML_NS, ancestor.localName)
    for (const { name, value } of ancestor.attributes)
      shell.setAttribute(name, value)
    shell.setAttribute(
      'style',
      `${ancestor.getAttribute('style') ?? ''};display:contents`
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
  const sources = source.querySelectorAll('textarea, input')
  const clones = clone.querySelectorAll('textarea, input')
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
  for (const element of clone.querySelectorAll(REPLACED_ELEMENTS))
    element.setAttribute(
      'style',
      `${element.getAttribute('style') ?? ''};visibility:hidden`
    )
}

async function loadImage(src: string): Promise<HTMLImageElement | undefined> {
  const image = new Image()
  image.src = src
  try {
    await image.decode()
    return image
  } catch {
    return undefined
  }
}

function paddedBounds(elements: readonly PositionedElement[], padding: number) {
  if (elements.length === 0) return undefined
  const left = Math.min(...elements.map(({ x }) => x)) - padding
  const top = Math.min(...elements.map(({ y }) => y)) - padding
  const right =
    Math.max(...elements.map(({ x, element }) => x + element.offsetWidth)) +
    padding
  const bottom =
    Math.max(...elements.map(({ y, element }) => y + element.offsetHeight)) +
    padding
  const width = right - left
  const height = bottom - top
  if (!(width > 0 && height > 0)) return undefined
  return { left, top, width, height }
}

function toSvgMarkup(
  content: Element,
  width: number,
  height: number,
  pixelRatio: number
): string {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', String(width * pixelRatio))
  svg.setAttribute('height', String(height * pixelRatio))
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  const foreignObject = document.createElementNS(SVG_NS, 'foreignObject')
  foreignObject.setAttribute('width', '100%')
  foreignObject.setAttribute('height', '100%')
  foreignObject.append(content)
  svg.append(foreignObject)
  return new XMLSerializer().serializeToString(svg)
}

export function createElementRasterizer() {
  const styles = collectStyles()

  async function rasterize(
    elements: readonly PositionedElement[],
    { padding, pixelRatio, prepareClone }: RasterizeOptions
  ) {
    const bounds = paddedBounds(elements, padding)
    if (!bounds) return undefined
    const { left, top, width, height } = bounds

    const shells = ancestorShells(elements[0].element)
    for (const { element, x, y } of elements) {
      const clone = element.cloneNode(true)
      if (!(clone instanceof HTMLElement)) continue
      copyFormState(element, clone)
      hideReplacedElements(clone)
      clone.style.setProperty(
        'transform',
        `translate(${x - left}px, ${y - top}px)`
      )
      await prepareClone?.(clone, element)
      shells.innermost.append(clone)
    }

    const container = document.createElementNS(XHTML_NS, 'div')
    container.setAttribute(
      'style',
      `position:relative;width:${width}px;height:${height}px;overflow:hidden;`
    )
    const style = document.createElementNS(XHTML_NS, 'style')
    style.textContent = await styles
    container.append(style, shells.outermost)

    const markup = toSvgMarkup(container, width, height, pixelRatio)
    const image = await loadImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
    )
    return image && { image, x: left, y: top, width, height }
  }

  return { rasterize }
}
