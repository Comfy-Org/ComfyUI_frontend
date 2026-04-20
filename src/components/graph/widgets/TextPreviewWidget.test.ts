/* eslint-disable vue/one-component-per-file */
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

const execHolder = vi.hoisted(() => ({
  state: null as {
    executingNodeIds: Array<string | number>
    isIdle: boolean
  } | null
}))

vi.mock('@/stores/executionStore', async () => {
  const { reactive } = await import('vue')
  execHolder.state = reactive({
    executingNodeIds: [] as Array<string | number>,
    isIdle: true
  })
  return {
    useExecutionStore: () => execHolder.state
  }
})

const execState = (): {
  executingNodeIds: Array<string | number>
  isIdle: boolean
} => execHolder.state!

import TextPreviewWidget from './TextPreviewWidget.vue'

const SkeletonStub = defineComponent({
  name: 'Skeleton',
  template: '<div data-testid="skeleton" />'
})

function renderPreview(
  text: string,
  { nodeId = 'node-1' }: { nodeId?: string | number } = {}
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
    execState().executingNodeIds = []
    execState().isIdle = true
    vi.clearAllMocks()
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
    it('strips img tags with inline event handlers', () => {
      const { container } = renderPreview('<img src=x onerror="alert(1)">')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const img = container.querySelector('img')
      // DOMPurify removes on* handlers; an <img> with an onerror should be
      // dropped entirely or at minimum have the handler stripped.
      expect(img?.getAttribute('onerror')).toBeNull()
    })

    it('strips script tags from raw HTML in modelValue', () => {
      const { container } = renderPreview(
        'hello<script>window.__xss = true</script>world'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('script')).toBeNull()
    })

    it('strips inline javascript: hrefs on anchors', () => {
      const { container } = renderPreview(
        '<a href="javascript:alert(1)">click</a>'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const anchor = container.querySelector('a')
      const href = anchor?.getAttribute('href')
      expect(href === null || !href.startsWith('javascript:')).toBe(true)
    })
  })

  describe('Execution state', () => {
    it('hides the Skeleton on mount when execution is already idle', () => {
      execState().executingNodeIds = []
      execState().isIdle = true
      renderPreview('text', { nodeId: 'n1' })
      expect(screen.queryByTestId('skeleton')).toBeNull()
    })

    it('shows a Skeleton on mount when the parent node is executing', () => {
      execState().executingNodeIds = ['n1']
      execState().isIdle = false
      renderPreview('text', { nodeId: 'n1' })
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    })

    it('hides the Skeleton when execution transitions to idle', async () => {
      execState().executingNodeIds = ['n1']
      execState().isIdle = false
      renderPreview('text', { nodeId: 'n1' })
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()

      execState().executingNodeIds = []
      execState().isIdle = true
      await nextTick()

      expect(screen.queryByTestId('skeleton')).toBeNull()
    })

    it('hides the Skeleton when the parent node leaves executingNodeIds', async () => {
      execState().executingNodeIds = ['n1']
      execState().isIdle = false
      renderPreview('text', { nodeId: 'n1' })

      execState().executingNodeIds = ['other']
      await nextTick()

      expect(screen.queryByTestId('skeleton')).toBeNull()
    })
  })
})
