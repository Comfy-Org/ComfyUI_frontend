// @vitest-environment jsdom
// dompurify is inert under happy-dom — see the tripwire note in
// vitest.setup.ts (capricorn86/happy-dom#2182, FE-1189).
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import type * as NodePreviewModule from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'
import type { ComfyApp } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import TextPreviewWidget from './TextPreviewWidget.vue'
vi.mock(import('@/scripts/app'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return { app: fromPartial<ComfyApp>({}) }
})
vi.mock(
  import('@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'),
  async () => {
    const { fromPartial } = await import('@total-typescript/shoehorn')
    return fromPartial<typeof NodePreviewModule>({ default: {} })
  }
)

const SkeletonStub = defineComponent({
  name: 'Skeleton',
  template: '<div data-testid="skeleton" />'
})

function renderPreview(
  text: string,
  { nodeId = toNodeId('node-1') }: { nodeId?: NodeId } = {}
) {
  const value = ref(text)
  const Harness = defineComponent({
    components: { TextPreviewWidget },
    setup: () => ({ value, nodeId }),
    template: '<TextPreviewWidget v-model="value" :node-id="nodeId" />'
  })
  return render(Harness, {
    global: {
      plugins: [PrimeVue],
      stubs: { Skeleton: SkeletonStub }
    }
  })
}

describe('TextPreviewWidget', () => {
  beforeEach(() => {
    Object.assign(useExecutionStore(), { executingNodeIds: [] })
    Object.assign(useExecutionStore(), { isIdle: true })
  })

  describe('Text formatting', () => {
    it('renders plain text content', () => {
      const { container } = renderPreview('hello world')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const span = container.querySelector('span')
      expect(span?.innerHTML).toContain('hello world')
    })

    it('converts newlines to <br> tags', () => {
      const { container } = renderPreview('line1\nline2')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const span = container.querySelector('span')
      expect(span?.innerHTML).toContain('<br')
    })

    it('auto-links bare http URLs', () => {
      const { container } = renderPreview('visit https://example.com for info')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const anchor = container.querySelector('a')
      expect(anchor).not.toBeNull()
      expect(anchor?.getAttribute('href')).toBe('https://example.com')
    })
  })

  describe('Bracketed link tokens [[label|url]]', () => {
    it('renders an http link with the supplied label', () => {
      const { container } = renderPreview(
        'see [[Docs|https://docs.example.com]]'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const anchor = container.querySelector('a')
      expect(anchor).not.toBeNull()
      expect(anchor?.getAttribute('href')).toBe('https://docs.example.com')
      expect(anchor?.textContent).toBe('Docs')
    })

    it('sets target=_blank and rel=noopener for safety', () => {
      const { container } = renderPreview('[[Docs|https://x.example.com]]')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const anchor = container.querySelector('a')
      expect(anchor?.getAttribute('target')).toBe('_blank')
      expect(anchor?.getAttribute('rel')).toContain('noopener')
    })

    it('renders label as plain text when url is not http(s)', () => {
      const { container } = renderPreview('[[Local|javascript:alert(1)]]')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('a')).toBeNull()
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('span')?.textContent).toContain('Local')
    })

    it('escapes HTML in the label to prevent XSS', () => {
      const { container } = renderPreview(
        '[[<img src=x>|https://x.example.com]]'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const span = container.querySelector('span')
      expect(span?.innerHTML).toContain('&lt;img')
      expect(span?.innerHTML).not.toContain('<img src')
    })
  })

  describe('Raw HTML sanitisation in modelValue', () => {
    it('drops img tags entirely (strict allowlist is <a> + <br> only)', () => {
      const { container } = renderPreview('<img src=x onerror="alert(1)">')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const img = container.querySelector('img')
      expect(img).toBeNull()
    })

    it('drops script tags from raw HTML in modelValue', () => {
      const { container } = renderPreview(
        'hello<script>window.__xss = true</script>world'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('script')).toBeNull()
    })

    it('drops iframe tags', () => {
      const { container } = renderPreview(
        '<iframe src="https://evil.example.com"></iframe>'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('iframe')).toBeNull()
    })

    it('strips inline javascript: hrefs on anchors', () => {
      const { container } = renderPreview(
        '<a href="javascript:alert(1)">click</a>'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const anchor = container.querySelector('a')
      expect(anchor).not.toBeNull()
      const href = anchor?.getAttribute('href')
      expect(href == null || !href.startsWith('javascript:')).toBe(true)
    })

    it('preserves the <br> tag produced by nl2br', () => {
      const { container } = renderPreview('line1\nline2')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('br')).toBeInTheDocument()
    })
  })

  describe('Execution state', () => {
    it('hides the Skeleton on mount when execution is already idle', () => {
      Object.assign(useExecutionStore(), { executingNodeIds: [] })
      Object.assign(useExecutionStore(), { isIdle: true })
      renderPreview('text', { nodeId: toNodeId('n1') })
      expect(screen.queryByTestId('skeleton')).toBeNull()
    })

    it('shows a Skeleton on mount when the parent node is executing', () => {
      Object.assign(useExecutionStore(), { executingNodeIds: ['n1'] })
      Object.assign(useExecutionStore(), { isIdle: false })
      renderPreview('text', { nodeId: toNodeId('n1') })
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    })

    it('hides the Skeleton when execution transitions to idle', async () => {
      Object.assign(useExecutionStore(), { executingNodeIds: ['n1'] })
      Object.assign(useExecutionStore(), { isIdle: false })
      renderPreview('text', { nodeId: toNodeId('n1') })
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()

      Object.assign(useExecutionStore(), { executingNodeIds: [] })
      Object.assign(useExecutionStore(), { isIdle: true })
      await nextTick()

      expect(screen.queryByTestId('skeleton')).toBeNull()
    })

    it('hides the Skeleton when the parent node leaves executingNodeIds', async () => {
      Object.assign(useExecutionStore(), { executingNodeIds: ['n1'] })
      Object.assign(useExecutionStore(), { isIdle: false })
      renderPreview('text', { nodeId: toNodeId('n1') })

      Object.assign(useExecutionStore(), { executingNodeIds: ['other'] })
      await nextTick()

      expect(screen.queryByTestId('skeleton')).toBeNull()
    })
  })
})
