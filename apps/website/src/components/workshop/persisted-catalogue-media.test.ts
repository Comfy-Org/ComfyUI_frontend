import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'

import { preserveCatalogueMedia } from './persisted-catalogue-media'

afterEach(() => document.body.replaceChildren())

function fixture() {
  const island = document.createElement('astro-island')
  island.setAttribute('data-astro-transition-persist', 'ccc-hub-catalogue-en')
  island.setAttribute('component-url', '/ModelsPage.vue')
  island.innerHTML =
    '<div><video src="original.mp4"></video><span>between</span><audio src="original.mp3"></audio></div>'
  document.body.append(island)
  const newDocument = document.implementation.createHTMLDocument()
  newDocument.body.append(island.cloneNode(true))
  return { island, newDocument }
}

class TestTransition extends Event {
  readonly from = new URL('https://demo.test/hub/models/')
  to = new URL('https://demo.test/hub/workflows/')
  readonly direction = 'forward'
  readonly navigationType = 'push'
  readonly sourceElement = undefined
  readonly info = undefined
  readonly signal = new AbortController().signal
  get viewTransition(): ViewTransition {
    throw new Error('Unused view transition')
  }
  constructor(
    public newDocument: Document,
    public swap: () => void
  ) {
    super('astro:before-swap')
  }
}

function transition(
  newDocument: Document,
  swap: () => void
): DocumentEventMap['astro:before-swap'] {
  return new TestTransition(newDocument, swap)
}

function cloneMedia(island: HTMLElement) {
  for (const element of island.querySelectorAll('video, audio'))
    element.replaceWith(element.cloneNode(true))
}

it('delegates swap once and restores original video/audio identity and positions for Vue refs', () => {
  const { island, newDocument } = fixture()
  const originals = Array.from(island.querySelectorAll('video, audio'))
  const swap = vi.fn(() => cloneMedia(island))
  const event = transition(newDocument, swap)
  preserveCatalogueMedia(event, island)
  expect(island.querySelector('[data-ccc-preserved-media]')).toBeNull()
  event.swap()
  expect(swap).toHaveBeenCalledExactlyOnceWith()
  expect(Array.from(island.querySelectorAll('video, audio'))).toEqual(originals)
  expect(originals.every((element) => element.isConnected)).toBe(true)
  expect(island.querySelector('[data-ccc-preserved-media]')).toBeNull()
  originals[0].setAttribute('src', 'fresh-server.mp4')
  expect(island.querySelector('video')).toHaveAttribute(
    'src',
    'fresh-server.mp4'
  )
  expect(island.querySelector('span')).toHaveTextContent('between')
})

it('keeps Vue refs and fresh authoritative source patches attached to the restored node', async () => {
  const { island, newDocument } = fixture()
  const source = ref('initial.mp4')
  const video = ref<HTMLVideoElement | null>(null)
  const app = createApp({
    render: () => h('div', [h('video', { ref: video, src: source.value })])
  })
  app.mount(island)
  try {
    const original = video.value
    const event = transition(newDocument, () => cloneMedia(island))
    preserveCatalogueMedia(event, island)
    event.swap()
    expect(island.querySelector('video')).toBe(original)
    expect(video.value?.isConnected).toBe(true)
    source.value = 'fresh.mp4'
    await nextTick()
    expect(island.querySelector('video')).toBe(original)
    expect(island.querySelector('video')).toHaveAttribute('src', 'fresh.mp4')
  } finally {
    app.unmount()
  }
})

it.for(['missing', 'locale', 'component', 'legacy'] as const)(
  'does not wrap an unmatched %s island',
  (kind) => {
    const { island, newDocument } = fixture()
    const incoming = newDocument.querySelector('astro-island')
    if (!incoming) throw new Error('Missing fixture island')
    if (kind === 'missing') incoming.remove()
    if (kind === 'locale')
      incoming.setAttribute(
        'data-astro-transition-persist',
        'ccc-hub-catalogue-zh-CN'
      )
    if (kind === 'component')
      incoming.setAttribute('component-url', '/Other.vue')
    if (kind === 'legacy')
      island.setAttribute('data-astro-transition-persist', 'hub-catalogue')
    const swap = vi.fn()
    const event = transition(newDocument, swap)
    preserveCatalogueMedia(event, island)
    expect(event.swap).toBe(swap)
    expect(island.querySelector('[data-ccc-preserved-media]')).toBeNull()
  }
)

it('does not reinsert originals when swap removes the island', () => {
  const { island, newDocument } = fixture()
  const video = island.querySelector('video')
  const event = transition(newDocument, () => {
    cloneMedia(island)
    island.remove()
  })
  preserveCatalogueMedia(event, island)
  event.swap()
  expect(video?.isConnected).toBe(false)
  expect(document.querySelector('video')).toBeNull()
  expect(video).not.toHaveAttribute('data-ccc-preserved-media')
})

it('restores original marker values and cleans clones when the delegated swap throws', () => {
  const { island, newDocument } = fixture()
  const video = island.querySelector('video')
  if (!video) throw new Error('Missing fixture video')
  video.setAttribute('data-ccc-preserved-media', 'prior-value')
  const event = transition(newDocument, () => {
    cloneMedia(island)
    throw new Error('Swap failed')
  })
  preserveCatalogueMedia(event, island)
  expect(() => event.swap()).toThrow('Swap failed')
  expect(video).toHaveAttribute('data-ccc-preserved-media', 'prior-value')
  expect(island.querySelector('video')).toHaveAttribute(
    'data-ccc-preserved-media',
    'prior-value'
  )
  expect(island.querySelector('audio')).not.toHaveAttribute(
    'data-ccc-preserved-media'
  )
})
