import type { Point, Rect, Size } from './geometry'

interface ElementDescription {
  label: string
  role: string
  context: string
  testId: string | null
}

const LAYER_ATTRIBUTE = 'data-point-at-it-layer'

const INTERACTIVE = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="combobox"]',
  '[role="treeitem"]'
].join(', ')
const NAMED = '[aria-label], [title], [data-testid], [role]'
const CONTAINERS = [
  '[role="menu"]',
  '[role="menubar"]',
  '[role="dialog"]',
  '[role="toolbar"]',
  '[role="tablist"]',
  '[role="tabpanel"]',
  '[role="listbox"]',
  '[role="tree"]',
  '[role="navigation"]',
  '[role="region"]',
  'nav',
  'aside',
  'header',
  'dialog'
].join(', ')
const TAG_ROLES: Record<string, string> = {
  a: 'link',
  button: 'button',
  select: 'combobox',
  summary: 'button',
  textarea: 'textbox'
}
const MAX_LABEL_CHARS = 60
const TOO_LARGE = 0.5

function clean(text: string | null | undefined): string {
  const single = (text ?? '').replace(/\s+/g, ' ').trim()
  return single.length > MAX_LABEL_CHARS
    ? `${single.slice(0, MAX_LABEL_CHARS)}…`
    : single
}

function labelledBy(element: Element): string {
  const ids = element.getAttribute('aria-labelledby')?.split(/\s+/) ?? []
  return clean(
    ids
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
  )
}

function fieldLabel(element: Element): string {
  if (!(element instanceof HTMLInputElement)) return ''
  return clean(element.labels?.[0]?.textContent) || clean(element.placeholder)
}

function accessibleName(element: Element): string {
  return (
    clean(element.getAttribute('aria-label')) ||
    labelledBy(element) ||
    fieldLabel(element) ||
    clean(element.getAttribute('title'))
  )
}

function roleOf(element: Element): string {
  const tag = element.tagName.toLowerCase()
  const explicit = element.getAttribute('role')
  if (explicit) return explicit
  if (element instanceof HTMLInputElement) return `${element.type} field`
  return TAG_ROLES[tag] ?? tag
}

function contextOf(element: Element): string {
  const container = element.parentElement?.closest(CONTAINERS)
  if (!container) return ''
  const name =
    accessibleName(container) || clean(container.getAttribute('data-testid'))
  return name ? `${roleOf(container)} "${name}"` : roleOf(container)
}

export function isOwnElement(element: Element): boolean {
  return element.closest(`[${LAYER_ATTRIBUTE}]`) !== null
}

function coversMostOf(element: Element, viewport: Size): boolean {
  const { width, height } = element.getBoundingClientRect()
  return width * height > viewport.width * viewport.height * TOO_LARGE
}

/**
 * The nearest thing a person would call an interface element: a control
 * first, else something with a name, a role or a test id. Never the page
 * itself or a container that covers most of the window.
 */
export function meaningfulAncestor(
  element: Element,
  viewport: Size
): Element | null {
  const found = element.closest(INTERACTIVE) ?? element.closest(NAMED)
  if (!found || found === element.ownerDocument.body) return null
  if (found === element.ownerDocument.documentElement) return null
  return coversMostOf(found, viewport) ? null : found
}

export function describeElement(element: Element): ElementDescription {
  const testId = element.getAttribute('data-testid')
  return {
    label:
      accessibleName(element) ||
      clean(element.textContent) ||
      clean(testId) ||
      roleOf(element),
    role: roleOf(element),
    context: contextOf(element),
    testId
  }
}

function sameElement(
  element: Element,
  description: ElementDescription
): boolean {
  const found = describeElement(element)
  return found.label === description.label && found.role === description.role
}

/** Finds a marked element again after the page redrew it, or null. */
export function findElement(
  description: ElementDescription,
  root: ParentNode = document
): Element | null {
  const selector = description.testId
    ? `[data-testid="${CSS.escape(description.testId)}"]`
    : `${INTERACTIVE}, ${NAMED}`
  return (
    [...root.querySelectorAll(selector)].find(
      (element) => !isOwnElement(element) && sameElement(element, description)
    ) ?? null
  )
}

/** Scrolls whatever scrolls under `element`, as a wheel over it would. */
export function scrollUnder(element: Element, event: WheelEvent): void {
  for (
    let candidate: Element | null = element;
    candidate;
    candidate = candidate.parentElement
  ) {
    const { overflowX, overflowY } = getComputedStyle(candidate)
    const scrolls =
      (candidate.scrollHeight > candidate.clientHeight &&
        /auto|scroll/.test(overflowY)) ||
      (candidate.scrollWidth > candidate.clientWidth &&
        /auto|scroll/.test(overflowX))
    if (scrolls) {
      candidate.scrollBy({ left: event.deltaX, top: event.deltaY })
      return
    }
  }
}

/** The element's window rect, or null when it is not drawn. */
export function visibleRect(element: Element | null): Rect | null {
  if (!element?.isConnected) return null
  const { left, top, width, height } = element.getBoundingClientRect()
  return width > 0 && height > 0 ? { x: left, y: top, width, height } : null
}

/** The topmost element under a window point that is not the layer's own. */
export function topElementAt(point: Point): Element | null {
  return (
    document
      .elementsFromPoint(point.x, point.y)
      .find((element) => !isOwnElement(element)) ?? null
  )
}
