import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { RenderShape } from '@/lib/litegraph/src/litegraph'
import NodeFooter from '@/renderer/extensions/vueNodes/components/NodeFooter.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        enter: 'Enter',
        enterSubgraph: 'Enter Subgraph',
        error: 'Error'
      },
      rightSidePanel: {
        showAdvancedShort: 'Show Advanced',
        hideAdvancedShort: 'Hide Advanced',
        showAdvancedInputsButton: 'Show Advanced Inputs',
        hideAdvancedInputsButton: 'Hide Advanced Inputs'
      }
    }
  }
})

type Props = {
  isSubgraph: boolean
  hasAnyError: boolean
  showErrorsTabEnabled: boolean
  showAdvancedInputsButton?: boolean
  showAdvancedState?: boolean
  headerColor?: string
  shape?: RenderShape
}

const baseProps: Props = {
  isSubgraph: false,
  hasAnyError: false,
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
    it('renders nothing when no relevant flags are set', () => {
      renderFooter()
      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('renders error + enter tabs for subgraph with error (Case 1)', () => {
      renderFooter({
        isSubgraph: true,
        hasAnyError: true,
        showErrorsTabEnabled: true
      })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.getByText('Enter')).toBeTruthy()
      expect(screen.getByTestId('subgraph-enter-button')).toBeTruthy()
    })

    it('renders error + advanced tabs for regular node with error (Case 1b)', () => {
      renderFooter({
        hasAnyError: true,
        showErrorsTabEnabled: true,
        showAdvancedInputsButton: true
      })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.getByText('Show Advanced')).toBeTruthy()
    })

    it('swaps advanced label based on showAdvancedState (Case 1b)', () => {
      renderFooter({
        hasAnyError: true,
        showErrorsTabEnabled: true,
        showAdvancedState: true
      })
      expect(screen.getByText('Hide Advanced')).toBeTruthy()
    })

    it('renders error-only footer when no subgraph/advanced (Case 2)', () => {
      renderFooter({ hasAnyError: true, showErrorsTabEnabled: true })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.queryByTestId('subgraph-enter-button')).toBeNull()
    })

    it('renders subgraph-only footer without errors (Case 3)', () => {
      renderFooter({ isSubgraph: true })
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

  describe('emits', () => {
    let user: ReturnType<typeof userEvent.setup>

    beforeEach(() => {
      user = userEvent.setup()
    })

    it('emits openErrors when the error tab is clicked', async () => {
      const { emitted } = renderFooter({
        hasAnyError: true,
        showErrorsTabEnabled: true
      })
      await user.click(screen.getByText('Error'))
      expect(emitted()).toHaveProperty('openErrors')
    })

    it('emits enterSubgraph when the enter tab is clicked', async () => {
      const { emitted } = renderFooter({ isSubgraph: true })
      await user.click(screen.getByTestId('subgraph-enter-button'))
      expect(emitted()).toHaveProperty('enterSubgraph')
    })

    it('emits toggleAdvanced when the advanced tab is clicked', async () => {
      const { emitted } = renderFooter({ showAdvancedInputsButton: true })
      await user.click(screen.getByText('Show Advanced Inputs'))
      expect(emitted()).toHaveProperty('toggleAdvanced')
    })
  })

  describe('shape-based radius classes (getBottomRadius)', () => {
    it('BOX shape renders no rounded-b* class on the single-tab footer', () => {
      renderFooter({ isSubgraph: true, shape: RenderShape.BOX })
      expect(allButtonClasses()).not.toMatch(/rounded-b/)
    })

    it('CARD shape emits rounded-br variant on the single-tab footer', () => {
      renderFooter({ isSubgraph: true, shape: RenderShape.CARD })
      const classes = allButtonClasses()
      expect(classes).toMatch(/rounded-br-\[17px\]/)
      expect(classes).not.toMatch(/rounded-b-\[/)
    })

    it('default shape emits rounded-b variant on the single-tab footer', () => {
      renderFooter({ isSubgraph: true })
      expect(allButtonClasses()).toMatch(/rounded-b-\[17px\]/)
    })

    it('upgrades to 20px radius when the error tab is present', () => {
      renderFooter({ hasAnyError: true, showErrorsTabEnabled: true })
      expect(allButtonClasses()).toMatch(/rounded-b-\[20px\]/)
    })

    it('enter tab uses right-only rounding in dual-tab mode (Case 1)', () => {
      renderFooter({
        isSubgraph: true,
        hasAnyError: true,
        showErrorsTabEnabled: true
      })
      const enterBtn = screen.getByTestId('subgraph-enter-button')
      expect(enterBtn.className).toMatch(/rounded-br-\[20px\]/)
    })
  })

  describe('headerColor style', () => {
    it('applies backgroundColor to the enter button when headerColor is set', () => {
      renderFooter({ isSubgraph: true, headerColor: 'rgb(10, 20, 30)' })
      const enterBtn = screen.getByTestId('subgraph-enter-button')
      expect(enterBtn.getAttribute('style')).toMatch(
        /background-color:\s*rgb\(10,\s*20,\s*30\)/
      )
    })

    it('omits backgroundColor style when headerColor is missing', () => {
      renderFooter({ isSubgraph: true })
      const enterBtn = screen.getByTestId('subgraph-enter-button')
      expect(enterBtn.getAttribute('style') ?? '').not.toMatch(
        /background-color/
      )
    })
  })
})
