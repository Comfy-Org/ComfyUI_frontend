import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SidebarHelpCenterIcon from './SidebarHelpCenterIcon.vue'

const typeformState = vi.hoisted(() => ({
  typeformError: false,
  isValidTypeformId: true
}))

const embedSpy = vi.hoisted(() => vi.fn())

const canvasState = vi.hoisted(() => ({ linearMode: true }))

const helpCenterSpies = vi.hoisted(() => ({ toggleHelpCenter: vi.fn() }))

vi.mock('@/platform/surveys/useTypeformEmbed', async () => {
  const { computed } = await import('vue')
  return {
    useTypeformEmbed: (containerRef: unknown, formId: string) => {
      embedSpy(containerRef, formId)
      return {
        typeformError: computed(() => typeformState.typeformError),
        isValidTypeformId: computed(() => typeformState.isValidTypeformId),
        // The real composable echoes the id it validated.
        typeformId: computed(() => formId)
      }
    }
  }
})

vi.mock('@/composables/useHelpCenter', async () => {
  const { ref } = await import('vue')
  return {
    useHelpCenter: () => ({
      shouldShowRedDot: ref(false),
      toggleHelpCenter: helpCenterSpies.toggleHelpCenter
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => 'left' })
}))

vi.mock('@/renderer/core/canvas/canvasStore', async () => {
  const { computed, reactive } = await import('vue')
  return {
    useCanvasStore: () =>
      reactive({ linearMode: computed(() => canvasState.linearMode) })
  }
})

const FEEDBACK_LOAD_ERROR =
  'Failed to load feedback form. Please try again later.'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      menu: { help: 'Help' },
      sideToolbar: { helpCenter: 'Help Center' },
      linearMode: {
        giveFeedback: 'Give feedback',
        feedbackLoadError: FEEDBACK_LOAD_ERROR
      }
    }
  }
})

function renderIcon() {
  const user = userEvent.setup()
  const result = render(SidebarHelpCenterIcon, {
    props: { isSmall: false },
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        Popover: {
          template: '<div><slot name="button" /><slot /></div>'
        }
      }
    }
  })
  return { ...result, user }
}

describe('SidebarHelpCenterIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    typeformState.typeformError = false
    typeformState.isValidTypeformId = true
    canvasState.linearMode = true
  })

  it('mounts the Typeform embed container wired to the feedback form', () => {
    renderIcon()

    const embed = screen.getByTestId('feedback-embed')
    expect(embed).toHaveAttribute('data-tf-widget', 'jmmzmlKw')
    expect(embedSpy).toHaveBeenCalledWith(expect.anything(), 'jmmzmlKw')
    expect(screen.queryByText(FEEDBACK_LOAD_ERROR)).not.toBeInTheDocument()
  })

  it('shows the localized fallback instead of the embed when loading fails', () => {
    typeformState.typeformError = true
    renderIcon()

    expect(screen.getByText(FEEDBACK_LOAD_ERROR)).toBeInTheDocument()
    expect(screen.queryByTestId('feedback-embed')).not.toBeInTheDocument()
  })

  it('shows the localized fallback when the form id is invalid', () => {
    typeformState.isValidTypeformId = false
    renderIcon()

    expect(screen.getByText(FEEDBACK_LOAD_ERROR)).toBeInTheDocument()
    expect(screen.queryByTestId('feedback-embed')).not.toBeInTheDocument()
  })

  it('does not open the help center from the feedback button in app mode', async () => {
    const { user } = renderIcon()

    await user.click(screen.getByRole('button', { name: 'Give feedback' }))

    expect(helpCenterSpies.toggleHelpCenter).not.toHaveBeenCalled()
  })

  it('shows the help center button instead of the feedback popover in graph mode', () => {
    canvasState.linearMode = false
    renderIcon()

    expect(
      screen.getByRole('button', { name: 'Help Center' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Give feedback' })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('feedback-embed')).not.toBeInTheDocument()
  })

  it('toggles the help center on click in graph mode', async () => {
    canvasState.linearMode = false
    const { user } = renderIcon()

    await user.click(screen.getByRole('button', { name: 'Help Center' }))

    expect(helpCenterSpies.toggleHelpCenter).toHaveBeenCalled()
  })
})
