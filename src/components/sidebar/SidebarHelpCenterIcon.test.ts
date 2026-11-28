import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { ReleaseNote } from '@/platform/updates/common/releaseService'
import { useReleaseStore } from '@/platform/updates/common/releaseStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import SidebarHelpCenterIcon from './SidebarHelpCenterIcon.vue'

beforeEach(() => {
  useSettingStore().settingValues['Comfy.Sidebar.Location'] = 'left'
})

const typeformState = vi.hoisted(() => ({
  typeformError: false,
  isValidTypeformId: true
}))

const embedSpy = vi.hoisted(() => vi.fn())

const helpCenterSpies = vi.hoisted(() => ({ toggleHelpCenter: vi.fn() }))

vi.mock<unknown>(import('@/platform/surveys/useTypeformEmbed'), async () => {
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

vi.mock<unknown>(import('@/composables/useHelpCenter'), async () => {
  const { ref } = await import('vue')
  return {
    useHelpCenter: () => ({
      shouldShowRedDot: ref(false),
      toggleHelpCenter: helpCenterSpies.toggleHelpCenter
    })
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

function renderIcon(props: { isVisible?: boolean } = {}) {
  const preventAutofocus = (event: Event) => event.preventDefault()
  document.addEventListener(
    'focusScope.autoFocusOnMount',
    preventAutofocus,
    true
  )
  onTestFinished(() =>
    document.removeEventListener(
      'focusScope.autoFocusOnMount',
      preventAutofocus,
      true
    )
  )
  const user = userEvent.setup()
  const result = render(SidebarHelpCenterIcon, {
    props: { isSmall: false, ...props },
    global: {
      plugins: [i18n]
    }
  })
  return { ...result, user }
}

describe('SidebarHelpCenterIcon', () => {
  beforeEach(() => {
    typeformState.typeformError = false
    typeformState.isValidTypeformId = true
    useCanvasStore().linearMode = true
    Object.assign(useReleaseStore(), {
      recentRelease: null,
      shouldShowRedDot: false
    })
    vi.mocked(useReleaseStore().reportSurfaceShown).mockReturnValue(undefined)
  })

  it('mounts the Typeform embed container wired to the feedback form', async () => {
    const { user } = renderIcon()
    await user.click(screen.getByRole('button', { name: 'Give feedback' }))

    const embed = screen.getByTestId('feedback-embed')
    expect(embed).toHaveAttribute('data-tf-widget', 'jmmzmlKw')
    expect(embedSpy).toHaveBeenCalledWith(expect.anything(), 'jmmzmlKw')
    expect(screen.queryByText(FEEDBACK_LOAD_ERROR)).not.toBeInTheDocument()
  })

  it('shows the localized fallback instead of the embed when loading fails', async () => {
    typeformState.typeformError = true
    const { user } = renderIcon()
    await user.click(screen.getByRole('button', { name: 'Give feedback' }))

    expect(screen.getByText(FEEDBACK_LOAD_ERROR)).toBeInTheDocument()
    expect(screen.queryByTestId('feedback-embed')).not.toBeInTheDocument()
  })

  it('shows the localized fallback when the form id is invalid', async () => {
    typeformState.isValidTypeformId = false
    const { user } = renderIcon()
    await user.click(screen.getByRole('button', { name: 'Give feedback' }))

    expect(screen.getByText(FEEDBACK_LOAD_ERROR)).toBeInTheDocument()
    expect(screen.queryByTestId('feedback-embed')).not.toBeInTheDocument()
  })

  it('does not open the help center from the feedback button in app mode', async () => {
    const { user } = renderIcon()

    await user.click(screen.getByRole('button', { name: 'Give feedback' }))

    expect(helpCenterSpies.toggleHelpCenter).not.toHaveBeenCalled()
  })

  it('shows the help center button instead of the feedback popover in graph mode', () => {
    useCanvasStore().linearMode = false
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
    useCanvasStore().linearMode = false
    const { user } = renderIcon()

    await user.click(screen.getByRole('button', { name: 'Help Center' }))

    expect(helpCenterSpies.toggleHelpCenter).toHaveBeenCalled()
  })

  it('reports the release red dot only from a visible graph toolbar', async () => {
    useCanvasStore().linearMode = false
    Object.assign(useReleaseStore(), {
      recentRelease: { version: '1.2.3' } as ReleaseNote,
      shouldShowRedDot: true
    })

    const { rerender } = renderIcon({ isVisible: false })
    expect(useReleaseStore().reportSurfaceShown).not.toHaveBeenCalled()

    await rerender({ isVisible: true })
    expect(
      useReleaseStore().reportSurfaceShown
    ).toHaveBeenCalledExactlyOnceWith('red_dot', '1.2.3')
  })
})
