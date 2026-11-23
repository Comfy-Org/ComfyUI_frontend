import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import {
  showNodeOptions,
  toggleNodeOptions
} from '@/composables/graph/useMoreOptionsMenu'
import { LGraph, LGraphCanvas, LGraphNode } from '@comfyorg/litegraph/litegraph'
import en from '@/locales/en/main.json'
import fr from '@/locales/fr/main.json'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createTestCanvasElement } from '@comfyorg/litegraph/__fixtures__/canvasTestUtils'

import NodeContextMenu from './NodeContextMenu.vue'

const i18n = createI18n({ legacy: false, locale: 'en' })

describe('NodeContextMenu', () => {
  beforeEach(() => {
    useCanvasStore().canvas = fromPartial({
      canvas: document.createElement('canvas'),
      ds: { scale: 1, offset: [0, 0] }
    })
  })

  it('renders French core actions in order without losing a same-label extension or protected Delete', async () => {
    const graph = new LGraph()
    const canvas = new LGraphCanvas(createTestCanvasElement(), graph, {
      skip_events: true,
      skip_render: true
    })
    const node = new LGraphNode('Protected node')
    node.removable = false
    node.getExtraMenuOptions = () => [
      {
        content: 'Copier',
        callback: () => {
          node.title = 'Extension executed'
        }
      }
    ]
    graph.add(node)
    const canvasStore = useCanvasStore()
    canvasStore.canvas = canvas
    canvasStore.currentGraph = graph
    canvas.selectNode(node)
    await nextTick()
    const french = createI18n({
      legacy: false,
      locale: 'fr',
      messages: { en, fr }
    })
    render(NodeContextMenu, { global: { plugins: [french] } })

    showNodeOptions(
      new MouseEvent('contextmenu', { clientX: 100, clientY: 120 })
    )
    await screen.findByRole('menu')

    expect(
      screen
        .getAllByRole('menuitem')
        .map((item) => item.getAttribute('aria-label'))
    ).toEqual([
      'Renommer',
      'Copier',
      'Dupliquer',
      'Épingler',
      'Contourner',
      'Convertir en sous-graphe',
      'Réduire le nœud',
      'Forme',
      'Couleur',
      'Extensions',
      'Copier',
      'Supprimer'
    ])
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    await userEvent.click(
      screen.getAllByRole('menuitem', { name: 'Copier' })[1]
    )
    expect(node.title).toBe('Extension executed')
  })

  it('opens through the registered instance', async () => {
    render(NodeContextMenu, { global: { plugins: [i18n] } })
    const event = new PointerEvent('contextmenu', {
      bubbles: true,
      button: 2,
      clientX: 100,
      clientY: 120
    })

    showNodeOptions(event)

    expect(await screen.findByRole('menu')).toBeVisible()
  })

  it('refreshes options when toggled open', async () => {
    render(NodeContextMenu, { global: { plugins: [i18n] } })
    const event = new MouseEvent('click', {
      bubbles: true,
      clientX: 100,
      clientY: 120
    })

    toggleNodeOptions(event)

    expect(await screen.findByRole('menu')).toBeVisible()
    expect(
      screen.getByRole('menuitem', { name: 'contextMenu.Rename' })
    ).toBeVisible()
  })

  it('dismisses when an outside press is stopped before reaching the document', async () => {
    renderWithControls()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByRole('button', { name: 'More options' }))
    await screen.findByRole('menu')
    await user.pointer({
      keys: '[MouseLeft>]',
      target: screen.getByRole('button', { name: 'Graph canvas' })
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('stays closed when the control that opened it is clicked again', async () => {
    renderWithControls()
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const moreOptions = screen.getByRole('button', { name: 'More options' })

    await user.click(moreOptions)
    await screen.findByRole('menu')
    await user.click(moreOptions)

    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
  })

  it('opens on the next click after a press on its control that did not click', async () => {
    renderWithControls()
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const moreOptions = screen.getByRole('button', { name: 'More options' })

    await user.click(moreOptions)
    await screen.findByRole('menu')
    await user.pointer({ keys: '[MouseRight]', target: moreOptions })
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
    await user.click(moreOptions)

    expect(await screen.findByRole('menu')).toBeVisible()
  })

  it('reopens at another control when its press dismisses the menu', async () => {
    renderWithControls()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('region', { name: 'Canvas' })
    })
    await screen.findByRole('menu')
    await user.click(screen.getByRole('button', { name: 'More options' }))

    expect(await screen.findByRole('menu')).toBeVisible()
  })
})

function renderWithControls() {
  return render(
    defineComponent({
      components: { NodeContextMenu },
      setup: () => ({ showNodeOptions, toggleNodeOptions }),
      template:
        '<div role="region" aria-label="Canvas" @contextmenu="showNodeOptions($event)">Canvas</div><button @click="toggleNodeOptions($event)">More options</button><button @pointerdown.stop>Graph canvas</button><NodeContextMenu />'
    }),
    { global: { plugins: [i18n] } }
  )
}
