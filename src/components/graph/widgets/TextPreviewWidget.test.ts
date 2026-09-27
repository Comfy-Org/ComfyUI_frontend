// @vitest-environment jsdom
// dompurify is inert under happy-dom — see the tripwire note in
// vitest.setup.ts (capricorn86/happy-dom#2182, FE-1189).
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

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
    execState().executingNodeIds = []
    execState().isIdle = true
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

    it('escapes raw <a> tags instead of turning them into live anchors', () => {
      // Raw modelValue text is never treated as author-supplied HTML, so a
      // literal `<a href="javascript:...">` is displayed as visible text
      // rather than parsed into a clickable (and previously exploitable)
      // anchor element.
      const { container } = renderPreview(
        '<a href="javascript:alert(1)">click</a>'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('a')).toBeNull()
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('span')?.textContent).toContain(
        '<a href="javascript:alert(1)">click</a>'
      )
    })

    it('preserves the <br> tag produced by nl2br', () => {
      const { container } = renderPreview('line1\nline2')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('br')).toBeInTheDocument()
    })
  })

  describe('Bracket-delimited raw text (e.g. LoRA/embedding syntax)', () => {
    it('preserves <lora:name:weight>-style text instead of parsing it as a tag', () => {
      const { container } = renderPreview(
        'Loaded lora: <lora:my_style_v2:0.8> applied successfully'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const span = container.querySelector('span')
      expect(span?.textContent).toContain(
        'Loaded lora: <lora:my_style_v2:0.8> applied successfully'
      )
    })

    it('still linkifies URLs and turns newlines into <br> alongside bracket text', () => {
      const { container } = renderPreview(
        '<lora:foo:1.0>\nvisit https://example.com for details'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const span = container.querySelector('span')
      expect(span?.textContent).toContain('<lora:foo:1.0>')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('br')).toBeInTheDocument()
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const anchor = container.querySelector('a')
      expect(anchor?.getAttribute('href')).toBe('https://example.com')
    })

    it('keeps the [[label|url]] custom link syntax working next to bracket text', () => {
      const { container } = renderPreview(
        '<lora:foo:1.0> see [[Docs|https://docs.example.com]]'
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const span = container.querySelector('span')
      expect(span?.textContent).toContain('<lora:foo:1.0>')
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const anchor = container.querySelector('a')
      expect(anchor?.getAttribute('href')).toBe('https://docs.example.com')
      expect(anchor?.textContent).toBe('Docs')
    })
  })

  describe('Execution state', () => {
    it('hides the Skeleton on mount when execution is already idle', () => {
      execState().executingNodeIds = []
      execState().isIdle = true
      renderPreview('text', { nodeId: toNodeId('n1') })
      expect(screen.queryByTestId('skeleton')).toBeNull()
    })

    it('shows a Skeleton on mount when the parent node is executing', () => {
      execState().executingNodeIds = ['n1']
      execState().isIdle = false
      renderPreview('text', { nodeId: toNodeId('n1') })
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    })

    it('hides the Skeleton when execution transitions to idle', async () => {
      execState().executingNodeIds = ['n1']
      execState().isIdle = false
      renderPreview('text', { nodeId: toNodeId('n1') })
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()

      execState().executingNodeIds = []
      execState().isIdle = true
      await nextTick()

      expect(screen.queryByTestId('skeleton')).toBeNull()
    })

    it('hides the Skeleton when the parent node leaves executingNodeIds', async () => {
      execState().executingNodeIds = ['n1']
      execState().isIdle = false
      renderPreview('text', { nodeId: toNodeId('n1') })

      execState().executingNodeIds = ['other']
      await nextTick()

      expect(screen.queryByTestId('skeleton')).toBeNull()
    })
  })
})
