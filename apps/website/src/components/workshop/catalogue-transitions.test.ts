import { afterEach, expect, it, vi } from 'vitest'

import { skipCatalogueTransition } from './catalogue-transitions'

afterEach(() => document.body.replaceChildren())

class TestTransition extends Event {
  readonly from = new URL('https://demo.test/hub/models/')
  readonly to = new URL('https://demo.test/hub/workflows/')
  readonly direction = 'forward'
  readonly navigationType = 'push'
  readonly sourceElement = undefined
  readonly info = undefined
  readonly signal = new AbortController().signal
  readonly swap = () => {}
  readonly viewTransition: ViewTransition = {
    ready: Promise.resolve(),
    finished: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    types: new Set<string>(),
    skipTransition: vi.fn()
  }
  constructor(public newDocument: Document) {
    super('astro:before-swap')
  }
}
function fixture() {
  const island = document.createElement('astro-island')
  island.setAttribute('data-astro-transition-persist', 'ccc-hub-catalogue-en')
  island.setAttribute('component-url', '/CccModelsPage.vue')
  island.setAttribute('component-export', 'default')
  document.body.append(island)
  const newDocument = document.implementation.createHTMLDocument()
  const incoming = island.cloneNode(true)
  newDocument.body.append(incoming)
  return { island, incoming, event: new TestTransition(newDocument) }
}
it('removes the native overlay for a matching persisted CCC catalogue swap', () => {
  const { island, event } = fixture()
  skipCatalogueTransition(event, island)
  expect(event.viewTransition.skipTransition).toHaveBeenCalledOnce()
})
it.for(['legacy', 'detached', 'missing', 'component', 'export', 'locale'])(
  'retains ordinary transitions for %s boundaries',
  (kind) => {
    const { island, incoming, event } = fixture()
    if (kind === 'legacy')
      island.setAttribute('data-astro-transition-persist', 'legacy')
    if (kind === 'detached') island.remove()
    if (incoming instanceof HTMLElement) {
      if (kind === 'missing') incoming.remove()
      if (kind === 'component')
        incoming.setAttribute('component-url', '/Other.vue')
      if (kind === 'export') incoming.setAttribute('component-export', 'other')
      if (kind === 'locale')
        incoming.setAttribute(
          'data-astro-transition-persist',
          'ccc-hub-catalogue-zh-CN'
        )
    }
    skipCatalogueTransition(event, island)
    expect(event.viewTransition.skipTransition).not.toHaveBeenCalled()
  }
)
