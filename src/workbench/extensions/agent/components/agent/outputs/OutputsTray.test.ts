import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentOutputsTrayStore } from '@/workbench/extensions/agent/stores/agent/agentOutputsTrayStore'
import OutputsTray from './OutputsTray.vue'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/assets/composables/useMediaAssetActions'))
vi.mock(import('@/platform/assets/utils/assetDragUtil'), () => ({
  startAssetDrag: vi.fn()
}))
vi.mock(import('@/platform/assets/utils/outputAssetUtil'), { spy: true })

function output(name: string, overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: `id-${name}`,
    name,
    tags: ['output'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    preview_url: `/api/view?filename=${name}&type=output`,
    ...overrides
  }
}

function images(count: number): AssetItem[] {
  return Array.from({ length: count }, (_, index) =>
    output(`image-${index + 1}.png`)
  )
}

function runOfTwo(): AssetItem {
  return output('second.png', {
    id: 'job-1',
    user_metadata: {
      jobId: 'job-1',
      nodeId: '9',
      subfolder: '',
      outputCount: 2,
      allOutputs: [
        {
          filename: 'first.png',
          nodeId: '9',
          subfolder: '',
          type: 'output',
          mediaType: 'images'
        },
        {
          filename: 'second.png',
          nodeId: '9',
          subfolder: '',
          type: 'output',
          mediaType: 'images'
        }
      ]
    }
  })
}

type OutputList = ReturnType<typeof useAssetsStore>['outputAssets']

function seedOutputs(overrides: Partial<OutputList> = {}) {
  const list = {
    items: [],
    hasMore: false,
    isLoading: false,
    loadMore: vi.fn(async () => false),
    loadNew: vi.fn(async () => {}),
    invalidate: vi.fn(async () => {}),
    ...overrides
  } satisfies OutputList
  useAssetsStore().outputAssets = list
  return list
}

function renderTray({ open = true } = {}) {
  if (open) useAgentOutputsTrayStore().dispatch({ type: 'opened' })
  return render(OutputsTray, {
    global: {
      plugins: [i18n],
      stubs: {
        MediaLightbox: {
          props: ['allGalleryItems', 'activeIndex'],
          emits: ['update:activeIndex'],
          template: `
            <div
              data-testid="lightbox"
              :data-url="allGalleryItems[activeIndex].url"
              :data-count="allGalleryItems.length"
            >
              <button @click="$emit('update:activeIndex', activeIndex + 1)">
                Next in lightbox
              </button>
              <button @click="$emit('update:activeIndex', -1)">
                Close lightbox
              </button>
            </div>
          `
        }
      }
    }
  })
}

function tileNames(): (string | null)[] {
  return screen
    .getAllByRole('button', { name: /^Select / })
    .map((button) => button.getAttribute('aria-label'))
}

function tick(name: string): Promise<void> {
  return userEvent.click(screen.getByRole('button', { name: `Select ${name}` }))
}

function attachedNames(): string[] {
  return useAgentComposerStore().attachments.map(({ name }) => name)
}

describe('OutputsTray', () => {
  it('renders nothing while the tray is closed', () => {
    const list = seedOutputs({ items: images(2) })

    renderTray({ open: false })

    expect(screen.queryByTestId('agent-outputs-tray')).not.toBeInTheDocument()
    expect(list.loadNew).not.toHaveBeenCalled()
  })

  it('fetches the newest outputs once when it mounts open', () => {
    const list = seedOutputs({ items: images(2) })

    renderTray()

    expect(screen.getByRole('region', { name: 'Recent outputs' })).toBeVisible()
    expect(list.loadNew).toHaveBeenCalledTimes(1)
  })

  it('fetches the newest outputs again each time it opens', async () => {
    const list = seedOutputs({ items: images(2) })
    const tray = useAgentOutputsTrayStore()
    renderTray({ open: false })

    tray.dispatch({ type: 'opened' })
    await nextTick()
    expect(list.loadNew).toHaveBeenCalledTimes(1)

    tray.dispatch({ type: 'closed' })
    await nextTick()
    tray.dispatch({ type: 'opened' })
    await nextTick()
    expect(list.loadNew).toHaveBeenCalledTimes(2)
  })

  it('shows nine placeholders while the first outputs load', () => {
    seedOutputs({ isLoading: true })

    renderTray()

    expect(screen.getAllByTestId('agent-outputs-skeleton')).toHaveLength(9)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your outputs')
    expect(screen.queryByText('No outputs yet')).not.toBeInTheDocument()
  })

  it('keeps the tiles on screen while a refresh is loading', () => {
    seedOutputs({ items: images(2), isLoading: true })

    renderTray()

    expect(tileNames()).toEqual(['Select image-1.png', 'Select image-2.png'])
    expect(
      screen.queryByTestId('agent-outputs-skeleton')
    ).not.toBeInTheDocument()
  })

  it('offers a refresh when there are no outputs', async () => {
    const list = seedOutputs()
    renderTray()

    expect(screen.getByText('No outputs yet')).toBeVisible()
    expect(
      screen.getByText(
        'Images, videos and other files you generate will show up here.'
      )
    ).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(list.invalidate).toHaveBeenCalledTimes(1)
  })

  it('reveals the next page of outputs that are already loaded', async () => {
    const list = seedOutputs({ items: images(31) })
    renderTray()
    expect(tileNames()).toHaveLength(30)

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(tileNames()).toHaveLength(31)
    expect(list.loadMore).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Show more' })
    ).not.toBeInTheDocument()
  })

  it('asks the server for more once every loaded output is shown', async () => {
    let finishLoad: (advanced: boolean) => void = () => {}
    const pendingLoad = new Promise<boolean>((resolve) => {
      finishLoad = resolve
    })
    const list = seedOutputs({
      items: images(30),
      hasMore: true,
      loadMore: vi.fn(() => pendingLoad)
    })
    renderTray()

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(list.loadMore).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Loading more' })).toBeVisible()

    useAssetsStore().outputAssets.items = images(31)
    useAssetsStore().outputAssets.hasMore = false
    finishLoad(true)

    expect(
      await screen.findByRole('button', { name: 'Select image-31.png' })
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Loading more' })
    ).not.toBeInTheDocument()
  })

  it('reports a failed load and retries from the same button', async () => {
    const list = seedOutputs({ items: images(30), hasMore: true })
    renderTray()

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load more outputs. Try again."
    )

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(list.loadMore).toHaveBeenCalledTimes(2)
  })

  it('reports a load that throws as failed', async () => {
    seedOutputs({
      items: images(30),
      hasMore: true,
      loadMore: vi.fn(async () => {
        throw new Error('offline')
      })
    })
    renderTray()

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load more outputs. Try again."
    )
  })

  it('keeps the failure and the retry in place when a failed load ends the list', async () => {
    const list = seedOutputs({
      items: images(30),
      hasMore: true,
      loadMore: vi.fn(async () => {
        useAssetsStore().outputAssets.hasMore = false
        await nextTick()
        return false
      })
    })
    renderTray()
    const showMore = screen.getByRole('button', { name: 'Show more' })

    await userEvent.click(showMore)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load more outputs. Try again."
    )
    expect(showMore).toHaveAccessibleName('Show more')
    expect(showMore).toHaveFocus()

    await userEvent.click(showMore)

    expect(list.loadMore).toHaveBeenCalledTimes(2)
  })

  it('ignores a load that finishes after the tray was closed and reopened', async () => {
    let finishLoad: (advanced: boolean) => void = () => {}
    const pendingLoad = new Promise<boolean>((resolve) => {
      finishLoad = resolve
    })
    seedOutputs({
      items: images(30),
      hasMore: true,
      loadMore: vi.fn(() => pendingLoad)
    })
    const tray = useAgentOutputsTrayStore()
    renderTray()
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    tray.dispatch({ type: 'closed' })
    tray.dispatch({ type: 'opened' })
    useAssetsStore().outputAssets.items = images(61)
    finishLoad(true)
    await tick('image-1.png')

    expect(screen.getByText('1 selected')).toBeVisible()
    expect(tileNames()).toHaveLength(30)
  })

  it('offers nothing more when every output is shown', () => {
    seedOutputs({ items: images(30) })

    renderTray()

    expect(
      screen.queryByRole('button', { name: 'Show more' })
    ).not.toBeInTheDocument()
  })

  it('counts the ticked files in the action bar', async () => {
    seedOutputs({ items: images(3) })
    renderTray()

    expect(screen.getByText('Pick the files you want to use')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Add to conversation' })
    ).toBeDisabled()

    await tick('image-1.png')
    await tick('image-3.png')

    expect(
      screen.getByRole('button', { name: 'Select image-3.png' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 selected')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Download 2' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Add 2 to conversation' })
    ).toBeEnabled()
  })

  it('unticks a file that is ticked twice', async () => {
    seedOutputs({ items: images(2) })
    renderTray()

    await tick('image-1.png')
    await tick('image-1.png')

    expect(screen.getByText('Pick the files you want to use')).toBeVisible()
  })

  it('clears the ticked files', async () => {
    seedOutputs({ items: images(2) })
    renderTray()
    await tick('image-1.png')
    await tick('image-2.png')

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.getByText('Pick the files you want to use')).toBeVisible()
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('says how many ticked files can only be downloaded', async () => {
    seedOutputs({
      items: [output('image-1.png'), output('latent.safetensors')]
    })
    renderTray()

    await tick('image-1.png')
    await tick('latent.safetensors')

    expect(
      screen.getByText('1 selected file can only be downloaded')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Download 2' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Add 1 to conversation' })
    ).toBeEnabled()
  })

  it('explains why files that can only be downloaded cannot be added', async () => {
    seedOutputs({ items: [output('latent.safetensors')] })
    renderTray()

    await tick('latent.safetensors')

    const add = screen.getByRole('button', { name: 'Add to conversation' })
    expect(add).toBeDisabled()
    expect(add).toHaveAccessibleDescription(
      'These files can be downloaded but not added to a conversation'
    )
  })

  it('adds the ticked files in grid order, then closes and clears', async () => {
    seedOutputs({ items: images(3) })
    const tray = useAgentOutputsTrayStore()
    const { emitted } = renderTray()
    await tick('image-3.png')
    await tick('image-1.png')

    await userEvent.click(
      screen.getByRole('button', { name: 'Add 2 to conversation' })
    )

    expect(attachedNames()).toEqual(['image-1.png', 'image-3.png'])
    expect(emitted('attached')).toEqual([[2]])
    expect(tray.isOpen).toBe(false)
    expect(tray.selectedKeys.size).toBe(0)
    expect(screen.queryByTestId('agent-outputs-tray')).not.toBeInTheDocument()
  })

  it('does not add a file that is already in the message', async () => {
    seedOutputs({ items: images(2) })
    useAgentComposerStore().addAttachment({
      id: 'asset:image-1.png',
      name: 'image-1.png',
      ref: 'image-1.png'
    })
    const { emitted } = renderTray()

    expect(screen.getAllByText('In your message')).toHaveLength(1)

    await tick('image-1.png')
    await tick('image-2.png')
    await userEvent.click(
      screen.getByRole('button', { name: 'Add 1 to conversation' })
    )

    expect(attachedNames()).toEqual(['image-1.png', 'image-2.png'])
    expect(emitted('attached')).toEqual([[1]])
  })

  it('offers no add when every ticked file is already in the message', async () => {
    seedOutputs({ items: images(1) })
    useAgentComposerStore().addAttachment({
      id: 'asset:image-1.png',
      name: 'image-1.png',
      ref: 'image-1.png'
    })
    renderTray()

    await tick('image-1.png')

    expect(
      screen.getByRole('button', { name: 'Add to conversation' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download 1' })).toBeEnabled()
  })

  it('adds two ticked copies of the same file once', async () => {
    const hash = `blake3:${'a'.repeat(64)}`
    seedOutputs({
      items: [output('image-1.png', { hash }), output('image-2.png', { hash })]
    })
    const { emitted } = renderTray()
    await tick('image-1.png')
    await tick('image-2.png')

    await userEvent.click(
      screen.getByRole('button', { name: 'Add 1 to conversation' })
    )

    expect(attachedNames()).toEqual(['image-1.png'])
    expect(emitted('attached')).toEqual([[1]])
    expect(useToast().toasts).toEqual([])
  })

  it('warns when a file could not be added', async () => {
    seedOutputs({ items: images(2) })
    vi.spyOn(useAgentComposerStore(), 'addAttachment').mockReturnValueOnce(
      false
    )
    const { emitted } = renderTray()
    await tick('image-1.png')
    await tick('image-2.png')

    await userEvent.click(
      screen.getByRole('button', { name: 'Add 2 to conversation' })
    )

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: "1 file couldn't be added. Try again.",
        duration: 5000
      })
    ])
    expect(emitted('attached')).toEqual([[1]])
  })

  it('downloads each ticked tile as one file and stays open', async () => {
    const run = runOfTwo()
    seedOutputs({ items: [run, output('image-1.png')] })
    renderTray()
    await tick('second.png')
    await tick('image-1.png')

    await userEvent.click(screen.getByRole('button', { name: 'Download 2' }))

    expect(
      useMediaAssetActions().downloadAssets
    ).toHaveBeenCalledExactlyOnceWith([
      {
        ...run,
        user_metadata: { jobId: 'job-1', nodeId: '9', subfolder: '' }
      },
      output('image-1.png')
    ])
    expect(screen.getByRole('region', { name: 'Recent outputs' })).toBeVisible()
    expect(screen.getByText('Pick the files you want to use')).toBeVisible()
  })

  it('expands a run in place and selects one of its files on its own', async () => {
    seedOutputs({ items: [runOfTwo(), output('image-1.png')] })
    renderTray()
    expect(tileNames()).toEqual(['Select second.png', 'Select image-1.png'])

    await userEvent.click(
      screen.getByRole('button', { name: 'Show 1 more from this run' })
    )

    expect(
      await screen.findByRole('button', { name: 'Select first.png' })
    ).toBeVisible()
    expect(tileNames()).toEqual([
      'Select second.png',
      'Select first.png',
      'Select image-1.png'
    ])
    expect(
      screen.getByRole('button', { name: 'Hide the others from this run' })
    ).toHaveAttribute('aria-expanded', 'true')

    await tick('first.png')
    await userEvent.click(
      screen.getByRole('button', { name: 'Add 1 to conversation' })
    )

    expect(attachedNames()).toEqual(['first.png'])
  })

  it('marks a run busy while its other files load', async () => {
    let finishLoad: (children: AssetItem[]) => void = () => {}
    vi.mocked(resolveOutputAssetItems).mockReturnValueOnce(
      new Promise<AssetItem[]>((resolve) => {
        finishLoad = resolve
      })
    )
    seedOutputs({ items: [runOfTwo()] })
    renderTray()
    const badge = screen.getByRole('button', {
      name: 'Show 1 more from this run'
    })

    await userEvent.click(badge)
    expect(badge).toHaveAttribute('aria-busy', 'true')

    finishLoad([output('first.png')])

    expect(
      await screen.findByRole('button', { name: 'Select first.png' })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Hide the others from this run' })
    ).not.toHaveAttribute('aria-busy')
  })

  it('keeps a run busy when its badge is pressed again while it loads', async () => {
    let finishLoad: (children: AssetItem[]) => void = () => {}
    vi.mocked(resolveOutputAssetItems).mockReturnValueOnce(
      new Promise<AssetItem[]>((resolve) => {
        finishLoad = resolve
      })
    )
    seedOutputs({ items: [runOfTwo()] })
    renderTray()
    const badge = screen.getByRole('button', {
      name: 'Show 1 more from this run'
    })

    await userEvent.click(badge)
    await userEvent.click(badge)

    expect(badge).toHaveAttribute('aria-busy', 'true')

    finishLoad([output('first.png')])
    await screen.findByRole('button', { name: 'Select first.png' })
  })

  it('does not repeat the file a run tile already shows when it expands', async () => {
    seedOutputs({
      items: [
        output('second.png', {
          id: 'job-1',
          user_metadata: {
            jobId: 'job-1',
            subfolder: '',
            assetId: 'file-2',
            outputCount: 2,
            allOutputs: [
              {
                assetId: 'file-1',
                filename: 'first.png',
                nodeId: '',
                subfolder: '',
                type: 'output',
                mediaType: 'image'
              },
              {
                assetId: 'file-2',
                filename: 'second.png',
                nodeId: '',
                subfolder: '',
                type: 'output',
                mediaType: 'image'
              }
            ]
          }
        })
      ]
    })
    renderTray()

    await userEvent.click(
      screen.getByRole('button', { name: 'Show 1 more from this run' })
    )

    await screen.findByRole('button', { name: 'Select first.png' })
    expect(tileNames()).toEqual(['Select second.png', 'Select first.png'])
  })

  it('opens the previewed file in the lightbox among the media it can show', async () => {
    seedOutputs({
      items: [
        output('image-1.png'),
        output('mesh.glb'),
        output('clip.mp4'),
        output('voice.flac'),
        output('latent.safetensors')
      ]
    })
    renderTray()

    await userEvent.click(
      screen.getByRole('button', { name: 'Preview clip.mp4' })
    )

    const lightbox = await screen.findByTestId('lightbox')
    expect(lightbox.dataset.url).toBe('/api/view?filename=clip.mp4&type=output')
    expect(lightbox.dataset.count).toBe('3')
    expect(
      screen.getByRole('button', { name: 'Select clip.mp4' })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps the previewed file when newer outputs arrive above it', async () => {
    seedOutputs({ items: [output('image-1.png'), output('clip.mp4')] })
    renderTray()
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview clip.mp4' })
    )
    await screen.findByTestId('lightbox')

    useAssetsStore().outputAssets.items = [
      output('image-0.png'),
      output('image-1.png'),
      output('clip.mp4')
    ]
    await nextTick()

    expect(screen.getByTestId('lightbox').dataset.url).toBe(
      '/api/view?filename=clip.mp4&type=output'
    )
  })

  it('does not reopen the lightbox when its file comes back into view', async () => {
    seedOutputs({ items: images(30) })
    renderTray()
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview image-30.png' })
    )
    await screen.findByTestId('lightbox')

    useAssetsStore().outputAssets.items = [output('image-0.png'), ...images(30)]
    await nextTick()
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(
      screen.getByRole('button', { name: 'Select image-30.png' })
    ).toBeVisible()
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
  })

  it('does not reopen the lightbox when the tray is closed and opened again', async () => {
    seedOutputs({ items: images(1) })
    const tray = useAgentOutputsTrayStore()
    renderTray()
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview image-1.png' })
    )
    await screen.findByTestId('lightbox')

    tray.dispatch({ type: 'closed' })
    await nextTick()
    tray.dispatch({ type: 'opened' })
    await nextTick()

    expect(
      screen.getByRole('button', { name: 'Select image-1.png' })
    ).toBeVisible()
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
  })

  it('follows the lightbox to the next file and closes with it', async () => {
    seedOutputs({ items: [output('image-1.png'), output('clip.mp4')] })
    renderTray()
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview image-1.png' })
    )
    await screen.findByTestId('lightbox')

    await userEvent.click(
      screen.getByRole('button', { name: 'Next in lightbox' })
    )
    expect(screen.getByTestId('lightbox').dataset.url).toBe(
      '/api/view?filename=clip.mp4&type=output'
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Close lightbox' })
    )
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
  })

  it('opens a 3D file in the 3D viewer', async () => {
    seedOutputs({ items: [output('mesh.glb')] })
    renderTray()

    await userEvent.click(
      screen.getByRole('button', { name: 'Preview mesh.glb' })
    )

    expect(useDialogStore().showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'asset-3d-viewer',
        title: 'mesh.glb',
        props: { modelUrl: '/api/view?filename=mesh.glb&type=output' }
      })
    )
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
  })

  it('stops counting a ticked file that is no longer listed', async () => {
    seedOutputs({ items: images(2) })
    renderTray()
    await tick('image-1.png')
    await tick('image-2.png')

    useAssetsStore().outputAssets.items = [output('image-2.png')]

    expect(await screen.findByText('1 selected')).toBeVisible()
  })

  it('closes from its close button', async () => {
    seedOutputs({ items: images(1) })
    renderTray()

    await userEvent.click(screen.getByRole('button', { name: 'Close outputs' }))

    expect(useAgentOutputsTrayStore().isOpen).toBe(false)
    expect(screen.queryByTestId('agent-outputs-tray')).not.toBeInTheDocument()
  })

  it('closes on Escape pressed inside it without passing the key on', async () => {
    seedOutputs({ items: images(1) })
    const onDocumentKeydown = vi.fn()
    document.addEventListener('keydown', onDocumentKeydown)
    onTestFinished(() =>
      document.removeEventListener('keydown', onDocumentKeydown)
    )
    renderTray()
    const tray = screen.getByTestId('agent-outputs-tray')

    await userEvent.click(
      within(tray).getByRole('button', { name: 'Select image-1.png' })
    )
    await userEvent.keyboard('{Escape}')

    expect(useAgentOutputsTrayStore().isOpen).toBe(false)
    expect(onDocumentKeydown).not.toHaveBeenCalled()
  })

  it.for([
    { control: 'Clear', count: 1 },
    { control: 'Download 1', count: 1 },
    { control: 'Show more', count: 31 }
  ])(
    'moves focus to the tray when $control can no longer hold it',
    async ({ control, count }) => {
      seedOutputs({ items: images(count) })
      renderTray()
      await tick('image-1.png')

      await userEvent.click(screen.getByRole('button', { name: control }))

      expect(
        screen.getByRole('region', { name: 'Recent outputs' })
      ).toHaveFocus()
    }
  )

  it('still closes on Escape after Refresh gives way to the placeholders', async () => {
    seedOutputs({
      invalidate: vi.fn(async () => {
        useAssetsStore().outputAssets.isLoading = true
      })
    })
    renderTray()

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(screen.getByRole('region', { name: 'Recent outputs' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')

    expect(useAgentOutputsTrayStore().isOpen).toBe(false)
  })
})
