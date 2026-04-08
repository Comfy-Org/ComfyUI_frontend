/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/no-container */
import { render, waitFor } from '@testing-library/vue'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import EssentialNodesPanel from './EssentialNodesPanel.vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn().mockReturnValue('left')
  })
}))

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({
    startDrag: vi.fn(),
    handleNativeDrop: vi.fn(),
    cancelDrag: vi.fn()
  })
}))

vi.mock('@/components/node/NodePreviewCard.vue', () => ({
  default: { template: '<div />' }
}))

describe('EssentialNodesPanel', () => {
  function createMockNode(
    name: string
  ): RenderedTreeExplorerNode<ComfyNodeDefImpl> {
    return {
      key: `node-${name}`,
      label: name,
      icon: 'icon-[comfy--node]',
      type: 'node',
      totalLeaves: 1,
      data: {
        name,
        display_name: name
      } as ComfyNodeDefImpl
    }
  }

  function createMockFolder(
    name: string,
    children: RenderedTreeExplorerNode<ComfyNodeDefImpl>[]
  ): RenderedTreeExplorerNode<ComfyNodeDefImpl> {
    return {
      key: `folder-${name}`,
      label: name,
      icon: 'icon-[lucide--folder]',
      type: 'folder',
      totalLeaves: children.length,
      children
    }
  }

  function createMockRoot(): RenderedTreeExplorerNode<ComfyNodeDefImpl> {
    return {
      key: 'root',
      label: 'Root',
      icon: '',
      type: 'folder',
      totalLeaves: 6,
      children: [
        createMockFolder('images', [
          createMockNode('LoadImage'),
          createMockNode('SaveImage')
        ]),
        createMockFolder('video', [
          createMockNode('LoadVideo'),
          createMockNode('SaveVideo')
        ]),
        createMockFolder('audio', [
          createMockNode('LoadAudio'),
          createMockNode('SaveAudio')
        ])
      ]
    }
  }

  function renderComponent(
    root = createMockRoot(),
    expandedKeys: string[] = [],
    flatNodes: RenderedTreeExplorerNode<ComfyNodeDefImpl>[] = []
  ) {
    const WrapperComponent = {
      template: `<EssentialNodesPanel :root="root" :flat-nodes="flatNodes" v-model:expandedKeys="keys" />`,
      components: { EssentialNodesPanel },
      setup() {
        const keys = ref(expandedKeys)
        return { root, flatNodes, keys }
      }
    }
    return render(WrapperComponent, {
      global: {
        stubs: {
          Teleport: true,
          TabsContent: {
            template: '<div class="tabs-content"><slot /></div>'
          },
          CollapsibleRoot: {
            template:
              '<div class="collapsible-root" :data-state="open ? \'open\' : \'closed\'"><slot /></div>',
            props: ['open'],
            emits: ['update:open']
          },
          CollapsibleTrigger: {
            template:
              '<button class="collapsible-trigger" @click="$emit(\'click\')"><slot /></button>'
          },
          CollapsibleContent: {
            template: '<div class="collapsible-content"><slot /></div>'
          },
          EssentialNodeCard: {
            template: '<div data-testid="essential-node-card" />'
          }
        }
      }
    })
  }

  describe('folder rendering', () => {
    it('should render all top-level folders', () => {
      const { container } = renderComponent()
      expect(container.querySelectorAll('.collapsible-trigger')).toHaveLength(3)
    })

    it('should display folder labels', () => {
      const { container } = renderComponent()
      expect(container.textContent).toContain('images')
      expect(container.textContent).toContain('video')
      expect(container.textContent).toContain('audio')
    })
  })

  describe('default expansion', () => {
    it('should expand all folders by default when expandedKeys is empty', async () => {
      const { container } = renderComponent(createMockRoot(), [])

      await waitFor(() => {
        const roots = container.querySelectorAll('.collapsible-root')
        expect(roots[0].getAttribute('data-state')).toBe('open')
        expect(roots[1].getAttribute('data-state')).toBe('open')
        expect(roots[2].getAttribute('data-state')).toBe('open')
      })
    })

    it('should respect provided expandedKeys', async () => {
      const { container } = renderComponent(createMockRoot(), ['folder-audio'])

      await waitFor(() => {
        const roots = container.querySelectorAll('.collapsible-root')
        expect(roots[0].getAttribute('data-state')).toBe('closed')
        expect(roots[1].getAttribute('data-state')).toBe('closed')
        expect(roots[2].getAttribute('data-state')).toBe('open')
      })
    })

    it('should expand all provided keys', async () => {
      const { container } = renderComponent(createMockRoot(), [
        'folder-images',
        'folder-video',
        'folder-audio'
      ])

      await waitFor(() => {
        const roots = container.querySelectorAll('.collapsible-root')
        expect(roots[0].getAttribute('data-state')).toBe('open')
        expect(roots[1].getAttribute('data-state')).toBe('open')
        expect(roots[2].getAttribute('data-state')).toBe('open')
      })
    })
  })

  describe('with single folder', () => {
    it('should expand only one folder when there is only one', async () => {
      const root: RenderedTreeExplorerNode<ComfyNodeDefImpl> = {
        key: 'root',
        label: 'Root',
        icon: '',
        type: 'folder',
        totalLeaves: 2,
        children: [
          createMockFolder('images', [
            createMockNode('LoadImage'),
            createMockNode('SaveImage')
          ])
        ]
      }

      const { container } = renderComponent(root, [])

      await waitFor(() => {
        const roots = container.querySelectorAll('.collapsible-root')
        expect(roots).toHaveLength(1)
        expect(roots[0].getAttribute('data-state')).toBe('open')
      })
    })
  })

  describe('node cards', () => {
    it('should render node cards for each node in expanded folders', () => {
      const { container } = renderComponent(createMockRoot(), ['folder-images'])
      const cards = container.querySelectorAll(
        '[data-testid="essential-node-card"]'
      )
      expect(cards.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('flat nodes mode', () => {
    it('should render flat grid without collapsible folders when flatNodes is provided', () => {
      const flatNodes = [
        createMockNode('LoadAudio'),
        createMockNode('LoadImage'),
        createMockNode('SaveImage')
      ]
      const { container } = renderComponent(createMockRoot(), [], flatNodes)

      expect(container.querySelectorAll('.collapsible-root')).toHaveLength(0)

      const cards = container.querySelectorAll(
        '[data-testid="essential-node-card"]'
      )
      expect(cards).toHaveLength(3)
    })
  })
})
