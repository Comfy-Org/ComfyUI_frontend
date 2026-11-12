import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComponentProps } from 'vue-component-type-helpers'

import { RenderShape } from '@/lib/litegraph/src/litegraph'
import NodeFooter from '@/renderer/extensions/vueNodes/components/NodeFooter.vue'

vi.mock<unknown>(import('@/renderer/core/layout/store/layoutStore'), () => {
  const isDraggingVueNodes = ref(false)
  return { layoutStore: { isDraggingVueNodes } }
})

const { layoutStore } = await import('@/renderer/core/layout/store/layoutStore')

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        enter: 'Enter',
        enterSubgraph: 'Enter Subgraph',
        exitSubgraph: 'Exit subgraph',
        error: 'Error'
      },
      rightSidePanel: {
        errors: 'Issues',
        showAdvancedShort: 'Show Advanced',
        hideAdvancedShort: 'Hide Advanced',
        showAdvancedInputsButton: 'Show Advanced Inputs',
        hideAdvancedInputsButton: 'Hide Advanced Inputs'
      }
    }
  }
})

type Props = ComponentProps<typeof NodeFooter>

const baseProps: Props = {
  subgraphAction: undefined,
  errorSeverity: 'none',
  showErrorsTabEnabled: false
}

function renderFooter(overrides: Partial<Props> = {}) {
  return render(NodeFooter, {
    global: { plugins: [i18n] },
    props: { ...baseProps, ...overrides }
  })
}

function allButtonClasses(): string {
  return screen
    .getAllByRole('button')
    .map((b) => b.className)
    .join(' ')
}

describe('NodeFooter', () => {
  describe('rendering branches', () => {
    it('offers leaving through the same navigation action', async () => {
      const { emitted } = renderFooter({ subgraphAction: 'exit' })
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Exit subgraph' }))

      expect(emitted()).toHaveProperty('navigateSubgraph')
      expect(screen.queryByText('Enter Subgraph')).not.toBeInTheDocument()
    })

    it('renders nothing when no relevant flags are set', () => {
      renderFooter()
      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('renders error + enter tabs for subgraph with error (Case 1)', () => {
      renderFooter({
        subgraphAction: 'enter',
        errorSeverity: 'error',
        showErrorsTabEnabled: true
      })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.getByText('Enter')).toBeTruthy()
      expect(screen.getByTestId('subgraph-enter-button')).toBeTruthy()
    })

    it('renders error + advanced tabs for regular node with error (Case 1b)', () => {
      renderFooter({
        errorSeverity: 'error',
        showErrorsTabEnabled: true,
        showAdvancedInputsButton: true
      })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.getByText('Show Advanced')).toBeTruthy()
    })

    it('swaps advanced label based on showAdvancedState (Case 1b)', () => {
      renderFooter({
        errorSeverity: 'error',
        showErrorsTabEnabled: true,
        showAdvancedState: true
      })
      expect(screen.getByText('Hide Advanced')).toBeTruthy()
    })

    it('renders error-only footer when no subgraph/advanced (Case 2)', () => {
      renderFooter({ errorSeverity: 'error', showErrorsTabEnabled: true })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.queryByTestId('subgraph-enter-button')).toBeNull()
    })

    it('renders subgraph-only footer without errors (Case 3)', () => {
      renderFooter({ subgraphAction: 'enter' })
      expect(screen.getByText('Enter Subgraph')).toBeTruthy()
      expect(screen.queryByText('Error')).toBeNull()
    })

    it('renders advanced-only footer for regular node (Case 4, collapsed label)', () => {
      renderFooter({ showAdvancedInputsButton: true })
      expect(screen.getByText('Show Advanced Inputs')).toBeTruthy()
    })

    it('renders advanced-only footer for regular node (Case 4, expanded label)', () => {
      renderFooter({ showAdvancedState: true })
      expect(screen.getByText('Hide Advanced Inputs')).toBeTruthy()
    })
  })

  it.for([
    {
      name: 'regular',
      subgraphAction: undefined,
      showAdvancedInputsButton: false
    },
    {
      name: 'subgraph',
      subgraphAction: 'enter',
      showAdvancedInputsButton: false
    },
    {
      name: 'advanced',
      subgraphAction: undefined,
      showAdvancedInputsButton: true
    }
  ] as const)(
    'opens issues from the warning footer on a $name node',
    async (props) => {
      const user = userEvent.setup()
      const { emitted } = renderFooter({
        ...props,
        errorSeverity: 'missing',
        showErrorsTabEnabled: true
      })
      const button = screen.getByRole('button', { name: 'Issues' })
      expect(button).toHaveClass('bg-warning', 'text-warning-foreground')
      expect(
        screen.queryByRole('button', { name: 'Error' })
      ).not.toBeInTheDocument()
      await user.click(button)
      expect(emitted()).toHaveProperty('openErrors')
    }
  )

  describe('emits', () => {
    let user: ReturnType<typeof userEvent.setup>

    beforeEach(() => {
      user = userEvent.setup()
    })

    it('emits openErrors when the error tab is clicked', async () => {
      const { emitted } = renderFooter({
        errorSeverity: 'error',
        showErrorsTabEnabled: true
      })
      await user.click(screen.getByText('Error'))
      expect(emitted()).toHaveProperty('openErrors')
    })

    it('emits navigateSubgraph when the enter tab is clicked', async () => {
      const { emitted } = renderFooter({ subgraphAction: 'enter' })
      await user.click(screen.getByTestId('subgraph-enter-button'))
      expect(emitted()).toHaveProperty('navigateSubgraph')
    })

    it('emits toggleAdvanced when the advanced tab is clicked', async () => {
      const { emitted } = renderFooter({ showAdvancedInputsButton: true })
      await user.click(screen.getByText('Show Advanced Inputs'))
      expect(emitted()).toHaveProperty('toggleAdvanced')
    })

    describe('drag-then-click suppression', () => {
      beforeEach(() => {
        layoutStore.isDraggingVueNodes.value = false
      })

      it('does not emit navigateSubgraph when a node drag is in progress at pointerup', async () => {
        const { emitted } = renderFooter({ subgraphAction: 'enter' })
        layoutStore.isDraggingVueNodes.value = true
        await user.click(screen.getByTestId('subgraph-enter-button'))

        expect(emitted().navigateSubgraph).toBeUndefined()
      })

      it('only suppresses the immediately following click, not later ones', async () => {
        const { emitted } = renderFooter({ subgraphAction: 'enter' })
        const button = screen.getByTestId('subgraph-enter-button')

        layoutStore.isDraggingVueNodes.value = true
        await user.click(button)
        expect(emitted().navigateSubgraph).toBeUndefined()

        layoutStore.isDraggingVueNodes.value = false
        await user.click(button)
        expect(emitted()).toHaveProperty('navigateSubgraph')
      })
    })
  })

  describe('shape-based radius classes (getBottomRadius)', () => {
    it('BOX shape renders no rounded-b* class on the single-tab footer', () => {
      renderFooter({ subgraphAction: 'enter', shape: RenderShape.BOX })
      expect(allButtonClasses()).not.toMatch(/rounded-b/)
    })

    it('CARD shape emits rounded-br variant on the single-tab footer', () => {
      renderFooter({ subgraphAction: 'enter', shape: RenderShape.CARD })
      const classes = allButtonClasses()
      expect(classes).toMatch(/rounded-br-\(--node-radius\)/)
      expect(classes).not.toMatch(/\srounded-b-\w/)
    })

    it('default shape emits rounded-b variant on the single-tab footer', () => {
      renderFooter({ subgraphAction: 'enter' })
      expect(allButtonClasses()).toMatch(/rounded-b-\(--node-radius\)/)
    })

    it('enter tab uses right-only rounding in dual-tab mode (Case 1)', () => {
      renderFooter({
        subgraphAction: 'enter',
        errorSeverity: 'error',
        showErrorsTabEnabled: true
      })
      const enterBtn = screen.getByTestId('subgraph-enter-button')
      expect(enterBtn.className).toMatch(/rounded-br-\(--node-radius\)/)
    })
  })

  describe('headerColor style', () => {
    it('applies backgroundColor to the enter button when headerColor is set', () => {
      renderFooter({ subgraphAction: 'enter', headerColor: 'rgb(10, 20, 30)' })
      const enterBtn = screen.getByTestId('subgraph-enter-button')
      expect(enterBtn.getAttribute('style')).toMatch(
        /background-color:\s*rgb\(10,\s*20,\s*30\)/
      )
    })

    it('omits backgroundColor style when headerColor is missing', () => {
      renderFooter({ subgraphAction: 'enter' })
      const enterBtn = screen.getByTestId('subgraph-enter-button')
      expect(enterBtn.getAttribute('style') ?? '').not.toMatch(
        /background-color/
      )
    })
  })
})
