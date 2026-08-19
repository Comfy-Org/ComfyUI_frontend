import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

interface VisibleError {
  surface: string
  text: string
}

type VisibleErrorWindow = Window &
  typeof globalThis & {
    __cnVisibleErrors?: VisibleError[]
  }

const trackedPages = new WeakSet<Page>()

const visibleErrorSurfaceSelectors = [
  {
    surface: 'errorOverlay',
    selector: `[data-testid="${TestIds.dialogs.errorOverlay}"]`
  },
  {
    surface: 'errorDialog',
    selector: `[data-testid="${TestIds.dialogs.errorDialog}"]`
  },
  { surface: 'nodeRenderErrors', selector: '.node-error' },
  { surface: 'errorToasts', selector: '.p-toast-message-error' }
]

function installVisibleErrorRecorder(
  selectors: typeof visibleErrorSurfaceSelectors
): void {
  const target = window as VisibleErrorWindow
  if (target.__cnVisibleErrors !== undefined) return
  const seen = new Set<string>()
  const candidates = new Set<Element>()
  const visibilityObservers = new Map<Element, MutationObserver>()
  const errors: VisibleError[] = []
  const combinedSelector = selectors.map(({ selector }) => selector).join(',')
  target.__cnVisibleErrors = errors
  const record = (surface: string, element: Element) => {
    if (
      !(element instanceof HTMLElement) ||
      !element.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true
      })
    )
      return
    const text = (element.innerText || element.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300)
    const key = `${surface}\u0000${text}`
    if (seen.has(key)) return
    seen.add(key)
    errors.push({ surface, text })
  }
  const forgetCandidate = (element: Element) => {
    candidates.delete(element)
    visibilityObservers.get(element)?.disconnect()
    visibilityObservers.delete(element)
  }
  const bindVisibilityObserver = (candidate: Element) => {
    visibilityObservers.get(candidate)?.disconnect()
    const observer = new MutationObserver(() => {
      if (!candidate.isConnected) {
        forgetCandidate(candidate)
        return
      }
      recordMatchingSurfaces(candidate)
    })
    for (
      let ancestor = candidate.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    )
      observer.observe(ancestor, { attributes: true })
    observer.observe(candidate, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    })
    visibilityObservers.set(candidate, observer)
  }
  const recordMatchingSurfaces = (element: Element, bindVisibility = false) => {
    if (!element.matches(combinedSelector)) {
      if (candidates.has(element)) forgetCandidate(element)
      return
    }
    candidates.add(element)
    if (bindVisibility || !visibilityObservers.has(element))
      bindVisibilityObserver(element)
    for (const { surface, selector } of selectors) {
      if (!element.matches(selector)) continue
      record(surface, element)
    }
  }
  const discover = (element: Element, includeDescendants: boolean) => {
    recordMatchingSurfaces(element, true)
    if (!includeDescendants || element.childElementCount === 0) return
    for (const descendant of element.querySelectorAll(combinedSelector))
      recordMatchingSurfaces(descendant, true)
  }
  const sampleRelatedCandidates = (element: Element) => {
    recordMatchingSurfaces(element)
    for (const candidate of candidates) {
      if (!candidate.isConnected) {
        forgetCandidate(candidate)
        continue
      }
      if (
        candidate !== element &&
        (candidate.contains(element) || element.contains(candidate))
      )
        recordMatchingSurfaces(candidate)
    }
  }
  for (const element of document.querySelectorAll(combinedSelector))
    recordMatchingSurfaces(element, true)
  new MutationObserver((mutations) => {
    const exact = new Set<Element>()
    const subtrees = new Set<Element>()
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        if (mutation.target instanceof Element) exact.add(mutation.target)
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) subtrees.add(node)
          else if (node.parentElement) exact.add(node.parentElement)
        }
      } else if (mutation.target instanceof Element) exact.add(mutation.target)
    }
    for (const element of exact) sampleRelatedCandidates(element)
    for (const element of subtrees) discover(element, true)
  }).observe(document, {
    attributes: true,
    attributeFilter: ['class', 'data-testid'],
    childList: true,
    subtree: true
  })
}

export async function trackVisibleErrors(page: Page): Promise<void> {
  if (trackedPages.has(page)) return
  await page.addInitScript(
    installVisibleErrorRecorder,
    visibleErrorSurfaceSelectors
  )
  await page.evaluate(installVisibleErrorRecorder, visibleErrorSurfaceSelectors)
  trackedPages.add(page)
}

// The app's user-visible error surfaces. A regression run is green only if a
// human looking at the screen would see zero errors - not merely a clean
// console. The harness self-check asserts the overlay IS visible after a
// forced execution error, so these selectors are permanently proven live.
export function errorSurfaces(page: Page): Record<string, Locator> {
  return {
    errorOverlay: page.getByTestId(TestIds.dialogs.errorOverlay),
    errorDialog: page.getByTestId(TestIds.dialogs.errorDialog),
    nodeRenderErrors: page.locator('.node-error'),
    errorToasts: page.locator('.p-toast-message-error')
  }
}

async function surfaceTexts(
  page: Page,
  surface: string,
  locator: Locator
): Promise<string[]> {
  try {
    return (await locator.allInnerTexts()).map((text) =>
      text.replace(/\s+/g, ' ').trim().slice(0, 300)
    )
  } catch (error) {
    if (page.isClosed() || /has been closed/.test(String(error))) throw error
    return [`${surface} present but unreadable: ${String(error)}`]
  }
}

// The suite's central invariant: a regression run is green only if every
// user-visible error surface is empty at the caller's readiness boundary.
export async function expectNoVisibleErrors(
  page: Page,
  context: string
): Promise<void> {
  expect(
    trackedPages.has(page),
    `${context}: visible-error recorder was not installed before navigation`
  ).toBe(true)
  const history = await page.evaluate(
    () => (window as VisibleErrorWindow).__cnVisibleErrors
  )
  expect(
    history,
    `${context}: visible-error recorder sentinel is missing`
  ).toBeDefined()
  expect(history, `${context}: transient visible errors`).toEqual([])
  for (const [surface, locator] of Object.entries(errorSurfaces(page)))
    expect(
      await surfaceTexts(page, surface, locator),
      `${context}: ${surface}`
    ).toEqual([])
}
