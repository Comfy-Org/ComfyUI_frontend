import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SidebarHelpCenterIcon from './SidebarHelpCenterIcon.vue'

const typeformState = vi.hoisted(() => ({
  typeformError: false,
  isValidTypeformId: true,
  typeformId: 'jmmzmlKw'
}))

vi.mock('@/platform/surveys/useTypeformEmbed', async () => {
  const { computed } = await import('vue')
  return {
    useTypeformEmbed: () => ({
      typeformError: computed(() => typeformState.typeformError),
      isValidTypeformId: computed(() => typeformState.isValidTypeformId),
      typeformId: computed(() => typeformState.typeformId)
    })
  }
})

vi.mock('@/composables/useHelpCenter', async () => {
  const { ref } = await import('vue')
  return {
    useHelpCenter: () => ({
      shouldShowRedDot: ref(false),
      toggleHelpCenter: vi.fn()
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => 'left' })
}))

vi.mock('@/renderer/core/canvas/canvasStore', async () => {
  const { computed } = await import('vue')
  return {
    useCanvasStore: () => ({ linearMode: computed(() => true) })
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
  return render(SidebarHelpCenterIcon, {
    props: { isSmall: false },
    global: {
      plugins: [i18n],
      stubs: {
        Popover: {
          template: '<div><slot name="button" /><slot /></div>'
        },
        SidebarIcon: true
      }
    }
  })
}

describe('SidebarHelpCenterIcon', () => {
  beforeEach(() => {
    typeformState.typeformError = false
    typeformState.isValidTypeformId = true
  })

  it('mounts the Typeform embed container when the id is valid and loads', () => {
    const { container } = renderIcon()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- attribute hook: the embed target has no ARIA role
    expect(container.querySelector('[data-tf-widget]')).not.toBeNull()
    expect(screen.queryByText(FEEDBACK_LOAD_ERROR)).not.toBeInTheDocument()
  })

  it('shows the localized fallback instead of the embed when loading fails', () => {
    typeformState.typeformError = true
    const { container } = renderIcon()

    expect(screen.getByText(FEEDBACK_LOAD_ERROR)).toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- attribute hook: the embed target has no ARIA role
    expect(container.querySelector('[data-tf-widget]')).toBeNull()
  })

  it('shows the localized fallback when the form id is invalid', () => {
    typeformState.isValidTypeformId = false
    const { container } = renderIcon()

    expect(screen.getByText(FEEDBACK_LOAD_ERROR)).toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- attribute hook: the embed target has no ARIA role
    expect(container.querySelector('[data-tf-widget]')).toBeNull()
  })
})
