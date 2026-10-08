import userEvent from '@testing-library/user-event'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { i18n } from '@/i18n'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

const asset = {
  id: 'source',
  name: 'source.png',
  ref: 'uploaded-source.png',
  previewUrl: 'https://example.com/source.png'
}

type MediaSurfaces = {
  chip: HTMLElement
  trayItem: HTMLElement
  menuItem: HTMLElement
}

function setup() {
  const store = useAgentComposerStore()
  store.setNodeScope('workflow-a')
  const send = vi.fn()
  const Host = defineComponent({
    setup: () => () =>
      h(Composer, {
        hasWorkflowTarget: true,
        selectionTags: store.nodes,
        onSend: send
      })
  })
  const view = render(Host, {
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...view, store, send, editor: screen.getByRole('textbox') }
}

function trackResizes() {
  const callbacks = new Map<Element, Set<() => void>>()
  vi.stubGlobal(
    'ResizeObserver',
    class implements ResizeObserver {
      private targets = new Set<Element>()
      private notify: () => void
      constructor(callback: ResizeObserverCallback) {
        this.notify = () => callback([], this)
      }
      observe(target: Element) {
        this.targets.add(target)
        const listeners = callbacks.get(target) ?? new Set<() => void>()
        listeners.add(this.notify)
        callbacks.set(target, listeners)
      }
      unobserve(target: Element) {
        callbacks.get(target)?.delete(this.notify)
        this.targets.delete(target)
      }
      disconnect() {
        for (const target of this.targets) this.unobserve(target)
      }
    }
  )
  return (target: Element) =>
    callbacks.get(target)?.forEach((notify) => notify())
}

function setTrayGeometry(
  tray: HTMLElement,
  width: number,
  contentWidth: number
) {
  const dimensions = { width, contentWidth }
  let left = 0
  Object.defineProperties(tray, {
    clientWidth: { get: () => dimensions.width },
    scrollWidth: { get: () => dimensions.contentWidth },
    scrollLeft: {
      get: () => {
        left = Math.min(
          left,
          Math.max(0, dimensions.contentWidth - dimensions.width)
        )
        return left
      },
      set: (value: number) => {
        left = value
      }
    },
    scrollTo: {
      value: (options: ScrollToOptions) => {
        tray.scrollLeft = options.left ?? tray.scrollLeft
        tray.dispatchEvent(new Event('scroll'))
      }
    }
  })
  return dimensions
}

describe('composer asset tray', () => {
  it('updates every inline video thumbnail without changing its references or opening a preview', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    store.addAttachment({
      id: 'video',
      name: 'My video',
      ref: '',
      mediaKind: 'video',
      mediaUrl: 'blob:video',
      uploading: true
    })
    store.referenceAttachment('video')
    store.referenceAttachment('video')
    const chips = await screen.findAllByTestId('asset-reference-chip')
    expect(
      chips.map((chip) =>
        within(chip)
          .getByRole('img', { name: 'Video' })
          .getAttribute('aria-label')
      )
    ).toEqual(['Video', 'Video'])
    store.updateAttachment('video', {
      ref: 'stored.mp4',
      mediaUrl: '/stored.mp4',
      previewUrl: '/poster.png',
      uploading: false
    })
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId('asset-reference-chip')
          .map((chip) => within(chip).getByAltText('').getAttribute('src'))
      ).toEqual(['/poster.png', '/poster.png'])
    )
    await user.hover(screen.getAllByTestId('asset-reference-chip')[0])
    expect(screen.getByRole('group', { name: 'My video' })).toHaveAttribute(
      'data-highlighted',
      'true'
    )
    expect(
      screen.queryByRole('region', { name: 'My video' })
    ).not.toBeInTheDocument()
    expect(store.prompt.references).toHaveLength(2)
    expect(store.attachments).toHaveLength(1)
  })

  it('shows the audio type of a renamed inline attachment', async () => {
    const { store } = setup()
    store.addAttachment({
      id: 'audio',
      name: 'Recording',
      ref: 'song.mp3',
      mediaKind: 'audio',
      mediaUrl: '/song.mp3'
    })
    store.referenceAttachment('audio')
    const chip = await screen.findByTestId('asset-reference-chip')
    expect(within(chip).getByRole('img', { name: 'Audio' })).toBeInTheDocument()
  })

  it.for([
    {
      name: 'My video',
      mediaKind: 'video',
      previewUrl: '/poster.png',
      indicators: ({ chip, trayItem, menuItem }: MediaSurfaces) => [
        within(chip).getByAltText(''),
        within(trayItem).getByAltText('My video'),
        within(menuItem).getByAltText('')
      ],
      sources: ['/poster.png', '/poster.png', '/poster.png'],
      labels: [null, null, null]
    },
    {
      name: 'Recording',
      mediaKind: 'audio',
      previewUrl: undefined,
      indicators: ({ chip, trayItem, menuItem }: MediaSurfaces) =>
        [chip, trayItem, menuItem].map((surface) =>
          within(surface).getByRole('img', { name: 'Audio' })
        ),
      sources: [null, null, null],
      labels: ['Audio', 'Audio', 'Audio']
    }
  ] as const)(
    'uses the same media indicator for $mediaKind in the tray, menu and inline',
    async ({ name, mediaKind, previewUrl, indicators, sources, labels }) => {
      const user = userEvent.setup()
      const { store, editor } = setup()
      store.addAttachment({
        id: 'media',
        name,
        ref: '/file',
        mediaKind,
        previewUrl
      })
      store.referenceAttachment('media')
      const chip = await screen.findByTestId('asset-reference-chip')
      await user.click(editor)
      await user.keyboard('@')
      const menuItem = await screen.findByRole('menuitem', { name })
      const trayItem = screen.getByRole('group', { name })
      const images = indicators({ chip, trayItem, menuItem })
      expect(images.map((image) => image.getAttribute('src'))).toEqual(sources)
      expect(images.map((image) => image.getAttribute('aria-label'))).toEqual(
        labels
      )
      await user.click(menuItem)
      expect(await screen.findAllByTestId('asset-reference-chip')).toHaveLength(
        2
      )
      expect(store.attachments).toHaveLength(1)
    }
  )

  it('announces all pending uploads outside the scroll viewport and preserves the draft on Enter', async () => {
    const user = userEvent.setup()
    const { store, editor, send } = setup()
    const status = screen.getByTestId('composer-upload-status')
    expect(status).toBeEmptyDOMElement()
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('aria-atomic', 'true')
    store.addAttachment({
      id: 'first',
      name: 'first.png',
      ref: '',
      uploading: true
    })
    store.addAttachment({
      id: 'second',
      name: 'second.png',
      ref: '',
      uploading: true
    })
    await user.type(editor, 'Keep my draft')
    expect(status).toHaveTextContent('Uploading 2 attachments')
    expect(
      within(screen.getByTestId('composer-asset-section')).queryByTestId(
        'composer-upload-status'
      )
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(send).not.toHaveBeenCalled()
    expect(store.draft).toBe('Keep my draft')
    store.updateAttachment('first', { ref: 'first.png', uploading: false })
    await waitFor(() =>
      expect(status).toHaveTextContent('Uploading 1 attachment')
    )
    store.removeAttachment('second')
    await waitFor(() => expect(status).toBeEmptyDOMElement())
    expect(screen.getByTestId('composer-upload-status')).toBe(status)
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    await user.keyboard('{Enter}')
    expect(send).toHaveBeenCalledExactlyOnceWith('Keep my draft', [
      expect.objectContaining({ id: 'first', ref: 'first.png' })
    ])
  })

  it('offers bounded page scrolling without changing the draft or included assets', async () => {
    const resize = trackResizes()
    const { store, editor } = setup()
    const assets = Array.from({ length: 8 }, (_, index) => ({
      id: `asset-${index}`,
      name: `asset-${index}.png`,
      ref: `asset-${index}.png`
    }))
    store.replaceDraft({
      text: '',
      attachments: assets,
      workflowReferences: []
    })
    await userEvent.type(editor, 'Keep this draft')
    const tray = screen.getByTestId('composer-asset-section')
    setTrayGeometry(tray, 250, 720)
    resize(tray)
    await fireEvent.scroll(tray)

    const previous = screen.getByRole('button', { name: 'Scroll Left' })
    const next = screen.getByRole('button', { name: 'Scroll Right' })
    expect(previous).toBeDisabled()
    expect(next).toBeEnabled()
    await userEvent.click(next)
    expect(tray.scrollLeft).toBe(250)
    expect(previous).toBeEnabled()
    expect(next).toBeEnabled()
    await userEvent.keyboard('{Enter}')
    expect(tray.scrollLeft).toBe(470)
    expect(next).toBeDisabled()
    await userEvent.click(previous)
    expect(tray.scrollLeft).toBe(220)
    expect(next).toBeEnabled()
    expect(store.draft).toBe('Keep this draft')
    expect(store.attachments).toEqual(assets)
  })

  it('updates overflow controls when the tray is resized', async () => {
    const resize = trackResizes()
    const { store } = setup()
    store.addAttachment(asset)
    store.addAttachment({ id: 'other', name: 'other.png', ref: 'other.png' })
    await nextTick()
    const tray = screen.getByTestId('composer-asset-section')
    const dimensions = setTrayGeometry(tray, 240, 192)
    resize(tray)
    await nextTick()
    expect(screen.queryByRole('button', { name: 'Scroll Right' })).toBeNull()

    dimensions.width = 160
    resize(tray)
    expect(
      await screen.findByRole('button', { name: 'Scroll Right' })
    ).toBeEnabled()

    dimensions.width = 240
    resize(tray)
    await nextTick()
    expect(screen.queryByRole('button', { name: 'Scroll Right' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Scroll Left' })).toBeNull()
  })

  it('clears overflow controls when removing assets makes the tray fit', async () => {
    const resize = trackResizes()
    const { store } = setup()
    store.addAttachment(asset)
    store.addAttachment({ id: 'other', name: 'other.png', ref: 'other.png' })
    await nextTick()
    const tray = screen.getByTestId('composer-asset-section')
    const dimensions = setTrayGeometry(tray, 160, 192)
    resize(tray)
    expect(
      await screen.findByRole('button', { name: 'Scroll Right' })
    ).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Scroll Right' }))
    expect(tray.scrollLeft).toBe(32)

    dimensions.contentWidth = 104
    await userEvent.click(
      within(screen.getByRole('group', { name: 'other.png' })).getByRole(
        'button',
        { name: 'Remove other.png' }
      )
    )

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Scroll Right' })).toBeNull()
    )
    expect(store.attachments).toEqual([asset])

    dimensions.contentWidth = 192
    store.addAttachment({ id: 'new', name: 'new.png', ref: 'new.png' })
    expect(
      await screen.findByRole('button', { name: 'Scroll Right' })
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Scroll Left' })).toBeDisabled()
    store.removeAttachment('new')
    store.removeAttachment(asset.id)
    await nextTick()
    expect(screen.queryByTestId('composer-asset-section')).toBeNull()
  })

  it('stages assets without changing the prompt, and sends unmentioned assets', async () => {
    const { store, editor, send } = setup()
    await userEvent.type(editor, 'Inspect these images')
    store.addAttachment(asset)
    await screen.findByRole('img', { name: asset.name })

    expect(editor).toHaveTextContent('Inspect these images')
    expect(screen.queryByTestId('asset-reference-chip')).not.toBeInTheDocument()
    expect(store.draft).toBe('Inspect these images')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(send).toHaveBeenCalledWith('Inspect these images', [asset])
  })

  it.for([
    {
      via: 'pointer',
      pick: () =>
        userEvent.click(screen.getByRole('menuitem', { name: asset.name }))
    },
    { via: 'keyboard', pick: () => userEvent.keyboard('{Enter}') }
  ])(
    'inserts a matching asset at the caret via $via and retains the tray',
    async ({ pick }) => {
      const { store, editor, send } = setup()
      store.addAttachment(asset)
      store.addAttachment({ id: 'other', name: 'other.png', ref: 'other.png' })
      await userEvent.type(editor, 'Use @source')
      const menu = screen.getByRole('menu', { name: 'Add to prompt' })
      expect(
        within(menu).queryByRole('menuitem', { name: 'other.png' })
      ).toBeNull()
      await pick()
      await screen.findByTestId('asset-reference-chip')
      expect(editor.textContent).toBe('Use source.png ')
      expect(store.attachments).toEqual([
        asset,
        { id: 'other', name: 'other.png', ref: 'other.png' }
      ])
      expect(
        within(screen.getByTestId('composer-asset-section')).getByRole(
          'group',
          { name: asset.name }
        )
      ).toBeVisible()
      await userEvent.keyboard('as the subject')
      expect(editor.textContent).toBe('Use source.png as the subject')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      expect(send).toHaveBeenCalledWith(
        'Use @[Image: source.png] as the subject',
        [asset, { id: 'other', name: 'other.png', ref: 'other.png' }]
      )
    }
  )

  it('keeps included assets through inline deletion, Undo and remount', async () => {
    const { store, editor, unmount } = setup()
    store.addAttachment(asset)
    await userEvent.type(editor, 'Use @source')
    await userEvent.keyboard('{Enter}{Backspace}{Backspace}')
    await waitFor(() =>
      expect(
        screen.queryByTestId('asset-reference-chip')
      ).not.toBeInTheDocument()
    )
    expect(store.attachments).toEqual([asset])
    await userEvent.keyboard('{Control>}z{/Control}')
    await screen.findByTestId('asset-reference-chip')
    expect(store.attachments).toEqual([asset])
    unmount()
    setup()
    expect(
      within(screen.getByTestId('composer-asset-section')).getByRole('group', {
        name: asset.name
      })
    ).toBeVisible()
    expect(screen.getByTestId('asset-reference-chip')).toHaveTextContent(
      asset.name
    )
  })

  it('allows repeated asset mentions, deletes only one, and sends the attachment once', async () => {
    const { store, editor, send } = setup()
    store.addAttachment(asset)
    await userEvent.type(editor, 'Use @source')
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('then @source')
    expect(screen.getByRole('menuitem', { name: asset.name })).toBeVisible()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('and @source')
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(screen.getAllByTestId('asset-reference-chip')).toHaveLength(3)
    )
    expect(editor.textContent).toBe(
      'Use source.png then source.png and source.png '
    )

    await userEvent.keyboard('{Backspace}{Backspace}')
    expect(screen.getAllByTestId('asset-reference-chip')).toHaveLength(2)
    expect(store.attachments).toEqual([asset])
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() =>
      expect(screen.getAllByTestId('asset-reference-chip')).toHaveLength(3)
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(send).toHaveBeenCalledWith(
      'Use @[Image: source.png] then @[Image: source.png] and @[Image: source.png]',
      [asset]
    )
  })

  it('removes only the chosen inline asset with its hover button, retains the tray, and supports Undo and continued typing', async () => {
    const user = userEvent.setup()
    const { store, editor } = setup()
    store.addAttachment(asset)
    await user.type(editor, 'Use @source')
    await user.keyboard('{Enter}then @source{Enter}after')
    const references = await screen.findAllByTestId('asset-reference-chip')
    expect(references).toHaveLength(2)
    await user.hover(references[0])
    const trayItem = within(
      screen.getByTestId('composer-asset-section')
    ).getByRole('group', { name: asset.name })
    expect(trayItem).toHaveAttribute('data-highlighted', 'true')
    await user.click(
      within(references[0]).getByRole('button', {
        name: 'Remove source.png reference'
      })
    )

    expect(screen.getAllByTestId('asset-reference-chip')).toHaveLength(1)
    expect(editor.textContent).toBe('Use then source.png after')
    expect(store.attachments).toEqual([asset])
    expect(editor).toHaveFocus()
    expect(trayItem).not.toHaveAttribute('data-highlighted')
    await user.keyboard('{Control>}z{/Control}')
    await waitFor(() =>
      expect(screen.getAllByTestId('asset-reference-chip')).toHaveLength(2)
    )
    expect(editor.textContent).toBe('Use source.png then source.png after')
    expect(trayItem).not.toHaveAttribute('data-highlighted')
    await user.keyboard('continued ')
    expect(editor).toHaveTextContent('continued')
    expect(store.attachments).toEqual([asset])
  })

  it('keeps typing uninterrupted after asset insertion and highlights its tray item on inline hover without opening a preview', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { store, editor } = setup()
    store.addAttachment(asset)
    await user.type(editor, 'Use @source')
    await user.keyboard('{Enter}')
    const chip = screen.getByTestId('asset-reference-chip')

    chip.dispatchEvent(
      new PointerEvent('pointerenter', { pointerType: 'mouse' })
    )
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(
      screen.queryByRole('dialog', { name: asset.name })
    ).not.toBeInTheDocument()
    expect(editor).toHaveFocus()
    await user.keyboard('and keep typing')
    expect(editor.textContent).toBe('Use source.png and keep typing')

    await user.hover(chip)
    await vi.advanceTimersByTimeAsync(300)
    expect(
      screen.queryByRole('dialog', { name: asset.name })
    ).not.toBeInTheDocument()
    const trayItem = within(
      screen.getByTestId('composer-asset-section')
    ).getByRole('group', { name: asset.name })
    expect(trayItem).toHaveAttribute('data-highlighted', 'true')
    expect(editor).toHaveFocus()

    await user.unhover(chip)
    expect(trayItem).not.toHaveAttribute('data-highlighted')
    expect(store.attachments).toEqual([asset])
  })

  it('highlights the tray while an inline asset has focus or hover, without opening a preview', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { store, editor } = setup()
    store.addAttachment(asset)
    await user.type(editor, '@source')
    await user.keyboard('{Enter}')

    await user.tab()
    const chip = screen.getByTestId('asset-reference-chip')
    expect(chip).toHaveFocus()
    await vi.advanceTimersByTimeAsync(300)
    expect(
      screen.queryByRole('dialog', { name: asset.name })
    ).not.toBeInTheDocument()
    const trayItem = within(
      screen.getByTestId('composer-asset-section')
    ).getByRole('group', { name: asset.name })
    expect(trayItem).toHaveAttribute('data-highlighted', 'true')

    await user.hover(chip)
    await user.tab({ shift: true })
    expect(editor).toHaveFocus()
    expect(trayItem).toHaveAttribute('data-highlighted', 'true')
    await user.unhover(chip)
    expect(trayItem).not.toHaveAttribute('data-highlighted')
  })

  it('maps repeated inline references to their tray asset and clears only the activity that ended', async () => {
    const user = userEvent.setup()
    const { store, editor } = setup()
    const other = { id: 'other', name: 'other.png', ref: 'other.png' }
    store.addAttachment(asset)
    store.addAttachment(other)
    await user.type(editor, '@source')
    await user.keyboard('{Enter}then @source{Enter}and @other{Enter}')
    const references = screen.getAllByTestId('asset-reference-chip')
    expect(references).toHaveLength(3)
    const tray = within(screen.getByTestId('composer-asset-section'))
    const sourceItem = tray.getByRole('group', { name: asset.name })
    const otherItem = tray.getByRole('group', { name: other.name })

    await user.tab()
    expect(references[0]).toHaveFocus()
    await user.hover(references[1])
    expect(sourceItem).toHaveAttribute('data-highlighted', 'true')
    expect(otherItem).not.toHaveAttribute('data-highlighted')
    await user.unhover(references[1])
    expect(sourceItem).toHaveAttribute('data-highlighted', 'true')

    await user.hover(references[2])
    expect(sourceItem).toHaveAttribute('data-highlighted', 'true')
    expect(otherItem).toHaveAttribute('data-highlighted', 'true')
    await user.unhover(references[2])
    expect(sourceItem).toHaveAttribute('data-highlighted', 'true')
    expect(otherItem).not.toHaveAttribute('data-highlighted')
    await user.click(editor)
    expect(sourceItem).not.toHaveAttribute('data-highlighted')
    expect(store.attachments).toEqual([asset, other])
  })

  it('retains the highlight from a hovered occurrence when another focused occurrence is removed', async () => {
    const user = userEvent.setup()
    const { store, editor } = setup()
    store.addAttachment(asset)
    await user.type(editor, '@source')
    await user.keyboard('{Enter}then @source{Enter}')
    const references = screen.getAllByTestId('asset-reference-chip')
    const trayItem = within(
      screen.getByTestId('composer-asset-section')
    ).getByRole('group', { name: asset.name })

    await user.tab()
    expect(references[0]).toHaveFocus()
    await user.hover(references[1])
    await user.tab()
    expect(
      within(references[0]).getByRole('button', {
        name: 'Remove source.png reference'
      })
    ).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getAllByTestId('asset-reference-chip')).toHaveLength(1)
    expect(editor).toHaveFocus()
    expect(trayItem).toHaveAttribute('data-highlighted', 'true')
    await user.unhover(references[1])
    expect(trayItem).not.toHaveAttribute('data-highlighted')
    expect(store.attachments).toEqual([asset])
  })

  it('opens a large asset preview from tray hover and closes it on leave or unmount', async () => {
    const user = userEvent.setup()
    const { store, editor, unmount } = setup()
    store.addAttachment(asset)
    await user.type(editor, '@source')
    await user.keyboard('{Enter}')
    await screen.findByTestId('asset-reference-chip')
    expect(
      screen.queryByRole('dialog', { name: asset.name })
    ).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', {
      name: `Preview ${asset.name}`
    })

    await user.hover(trigger)
    const preview = await screen.findByRole('dialog', { name: asset.name })
    expect(
      within(preview).getByRole('img', { name: asset.name })
    ).toHaveAttribute('src', asset.previewUrl)
    await user.unhover(trigger)
    await user.pointer({
      target: screen.getByRole('button', { name: 'Send' }),
      coords: { clientX: 500, clientY: 500 }
    })
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: asset.name })
      ).not.toBeInTheDocument()
    )

    await user.hover(trigger)
    await screen.findByRole('dialog', { name: asset.name })
    unmount()
    expect(
      screen.queryByRole('dialog', { name: asset.name })
    ).not.toBeInTheDocument()
  })

  it('inserts an asset in the middle of a sentence and preserves the following text', async () => {
    const { store, editor } = setup()
    store.addAttachment(asset)
    await userEvent.type(editor, 'Use  as background')
    await userEvent.keyboard('{Control>}a{/Control}{ArrowLeft}{ArrowRight>4/}')
    await userEvent.paste('@source')
    await userEvent.keyboard('{Enter}')

    await screen.findByTestId('asset-reference-chip')
    expect(editor.textContent).toBe('Use source.png as background')
    expect(store.prompt.text).toBe('Use  as background')
  })

  it('retires a tray asset and its inline reference despite late upload completion or Undo', async () => {
    const { store, editor } = setup()
    store.addAttachment({ ...asset, uploading: true, ref: '' })
    await userEvent.type(editor, 'Use @source')
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('and @source')
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(screen.getAllByTestId('asset-reference-chip')).toHaveLength(2)
    )
    await userEvent.click(
      within(screen.getByTestId('composer-asset-section')).getByRole('button', {
        name: 'Remove source.png'
      })
    )
    store.updateAttachment(asset.id, { uploading: false, ref: asset.ref })
    await waitFor(() =>
      expect(
        screen.queryByTestId('composer-asset-section')
      ).not.toBeInTheDocument()
    )
    await userEvent.click(editor)
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(store.attachments).toEqual([])
    expect(screen.queryByTestId('asset-reference-chip')).not.toBeInTheDocument()
  })

  it('shows nodes only inline without adding an asset', async () => {
    const { store } = setup()
    store.setNodes([{ id: '361', title: 'Save Image' }])
    await screen.findByTestId('node-reference-chip')
    expect(
      screen.queryByTestId('composer-node-section')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('composer-asset-section')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveTextContent('Save Image #361')
  })
})
