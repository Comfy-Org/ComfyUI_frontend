import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import messages from '@/locales/en/main.json'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import WidgetImageCompare from './WidgetImageCompare.vue'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

const savedItems = (filenames: string[]) =>
  filenames.map((filename) => ({ filename, type: 'temp' as const }))

const savedUrl = (filename: string) =>
  `/api/view?filename=${filename}&type=temp`

function buildGraph() {
  const graph = new LGraph()

  const compare = new LGraphNode('ImageCompare')
  compare.addInput('image_a', 'IMAGE')
  compare.addInput('image_b', 'IMAGE')
  graph.add(compare)

  Object.assign(app, { rootGraph: graph, canvas: { graph } })
  return { compare, graph }
}

function setSavedImages(
  compare: LGraphNode,
  before: string[],
  after: string[]
) {
  useNodeOutputStore().nodeOutputs[String(compare.id)] = {
    a_images: savedItems(before),
    b_images: savedItems(after)
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { batch: messages.batch, imageCompare: messages.imageCompare }
  }
})

function renderWidget(compare: LGraphNode) {
  return render(WidgetImageCompare, {
    global: { plugins: [i18n] },
    props: {
      widget: {
        name: 'compare_view',
        type: 'imagecompare',
        value: [],
        nodeLocatorId: createNodeLocatorId(null, compare.id)
      },
      nodeId: compare.id
    }
  })
}

describe('WidgetImageCompare', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
    useNodeOutputStore().resetAllOutputsAndPreviews()
  })

  describe('Image sources', () => {
    it('shows the images the node saved on its last run', () => {
      const { compare } = buildGraph()
      setSavedImages(compare, ['before.png'], ['after.png'])

      renderWidget(compare)

      const images = screen.getAllByRole('img')
      expect(images[0]).toHaveAttribute('src', savedUrl('after.png'))
      expect(images[1]).toHaveAttribute('src', savedUrl('before.png'))
    })

    it('shows the empty state while the node is unconnected and unrun', () => {
      const { compare } = buildGraph()

      renderWidget(compare)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.getByText('No images to compare')).toBeInTheDocument()
    })
  })

  describe('Comparison viewport', () => {
    it('labels each side for assistive technology', () => {
      const { compare } = buildGraph()
      setSavedImages(compare, ['before.png'], ['after.png'])

      renderWidget(compare)

      const images = screen.getAllByRole('img')
      expect(images[0]).toHaveAttribute('alt', 'After image')
      expect(images[1]).toHaveAttribute('alt', 'Before image')
    })

    it.for([
      { name: 'only a before image', before: ['before.png'], after: [] },
      { name: 'only an after image', before: [], after: ['after.png'] }
    ])('renders one image without a slider for $name', (row) => {
      const { compare } = buildGraph()
      setSavedImages(compare, row.before, row.after)

      renderWidget(compare)

      expect(screen.getAllByRole('img')).toHaveLength(1)
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
    })

    it('shows the slider handle when both sides have an image', () => {
      const { compare } = buildGraph()
      setSavedImages(compare, ['before.png'], ['after.png'])

      renderWidget(compare)

      expect(screen.getByRole('presentation')).toBeInTheDocument()
    })
  })

  describe('Batch navigation', () => {
    const before = ['a1.png', 'a2.png', 'a3.png']
    const after = ['b1.png', 'b2.png']

    it('counts each side when either has multiple images', () => {
      const { compare } = buildGraph()
      setSavedImages(compare, before, after)

      renderWidget(compare)

      expect(
        within(screen.getByTestId('before-batch')).getByTestId('batch-counter')
      ).toHaveTextContent('1 / 3')
      expect(
        within(screen.getByTestId('after-batch')).getByTestId('batch-counter')
      ).toHaveTextContent('1 / 2')
    })

    it.for([
      { name: 'single images', before: ['a1.png'], after: ['b1.png'] },
      { name: 'no images', before: [], after: [] }
    ])('hides the navigation for $name', (row) => {
      const { compare } = buildGraph()
      setSavedImages(compare, row.before, row.after)

      renderWidget(compare)

      expect(screen.queryByTestId('batch-nav')).not.toBeInTheDocument()
    })

    it('only offers controls for the side with multiple images', () => {
      const { compare } = buildGraph()
      setSavedImages(compare, before, ['b1.png'])

      renderWidget(compare)

      expect(
        within(screen.getByTestId('before-batch')).getByTestId('batch-counter')
      ).toBeInTheDocument()
      expect(screen.queryByTestId('after-batch')).not.toBeInTheDocument()
    })

    it('steps through the before batch without moving the after batch', async () => {
      const user = userEvent.setup()
      const { compare } = buildGraph()
      setSavedImages(compare, before, after)

      renderWidget(compare)
      const beforeBatch = screen.getByTestId('before-batch')
      const nextBtn = within(beforeBatch).getByTestId('batch-next')
      const prevBtn = within(beforeBatch).getByTestId('batch-prev')

      expect(prevBtn).toBeDisabled()

      await user.click(nextBtn)
      expect(screen.getAllByRole('img')[1]).toHaveAttribute(
        'src',
        savedUrl('a2.png')
      )

      await user.click(nextBtn)
      expect(
        within(beforeBatch).getByTestId('batch-counter')
      ).toHaveTextContent('3 / 3')
      expect(nextBtn).toBeDisabled()

      await user.click(prevBtn)
      const images = screen.getAllByRole('img')
      expect(images[1]).toHaveAttribute('src', savedUrl('a2.png'))
      expect(images[0]).toHaveAttribute('src', savedUrl('b1.png'))
    })

    it('steps through the after batch independently', async () => {
      const user = userEvent.setup()
      const { compare } = buildGraph()
      setSavedImages(compare, before, after)

      renderWidget(compare)
      const afterBatch = screen.getByTestId('after-batch')
      await user.click(within(afterBatch).getByTestId('batch-next'))

      expect(within(afterBatch).getByTestId('batch-counter')).toHaveTextContent(
        '2 / 2'
      )
      const images = screen.getAllByRole('img')
      expect(images[0]).toHaveAttribute('src', savedUrl('b2.png'))
      expect(images[1]).toHaveAttribute('src', savedUrl('a1.png'))
    })

    it('keeps the selected image when an unrelated link changes', async () => {
      const user = userEvent.setup()
      const { compare, graph } = buildGraph()
      setSavedImages(compare, ['a1.png', 'a2.png'], ['b1.png'])

      renderWidget(compare)
      await user.click(
        within(screen.getByTestId('before-batch')).getByTestId('batch-next')
      )
      expect(
        within(screen.getByTestId('before-batch')).getByTestId('batch-counter')
      ).toHaveTextContent('2 / 2')

      const producer = new LGraphNode('EmptyImage')
      producer.addOutput('IMAGE', 'IMAGE')
      graph.add(producer)
      const consumer = new LGraphNode('PreviewImage')
      consumer.addInput('images', 'IMAGE')
      graph.add(consumer)
      producer.connect(0, consumer, 0)
      await nextTick()

      expect(screen.getAllByRole('img')[1]).toHaveAttribute(
        'src',
        savedUrl('a2.png')
      )
    })

    it('returns to the first image when a newer run has fewer images', async () => {
      const user = userEvent.setup()
      const { compare } = buildGraph()
      setSavedImages(compare, ['a1.png', 'a2.png'], ['b1.png'])

      renderWidget(compare)
      await user.click(
        within(screen.getByTestId('before-batch')).getByTestId('batch-next')
      )
      expect(
        within(screen.getByTestId('before-batch')).getByTestId('batch-counter')
      ).toHaveTextContent('2 / 2')

      setSavedImages(compare, ['a3.png'], ['b1.png'])
      await nextTick()

      expect(screen.getAllByRole('img')[1]).toHaveAttribute(
        'src',
        savedUrl('a3.png')
      )
      expect(screen.queryByTestId('batch-nav')).not.toBeInTheDocument()
    })
  })
})
