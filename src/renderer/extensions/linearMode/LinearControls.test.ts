import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import LinearControls from './LinearControls.vue'

// Mock all dependencies - preserve actual exports to avoid missing defineStore
vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: vi.fn((store) => store)
  }
})

const mockCanAccessSubscriptionFeatures = ref(true)
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: mockCanAccessSubscriptionFeatures
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn()
  })
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueSettingsStore: () => ({
    batchCount: ref(1)
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn().mockReturnValue(10)
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: { filename: 'test.json' }
  })
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    isBuilderMode: ref(false)
  })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({
    hasOutputs: ref(true)
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackUiButtonClicked: vi.fn()
  })
}))

// Mock child components
vi.mock('@/components/builder/AppModeWidgetList.vue', () => ({
  default: { template: '<div data-testid="widget-list"></div>' }
}))

vi.mock('@/components/loader/Loader.vue', () => ({
  default: { template: '<div data-testid="loader"></div>' }
}))

vi.mock('@/components/common/ScrubableNumberInput.vue', () => ({
  default: { template: '<input data-testid="number-input" />' }
}))

vi.mock('@/components/ui/Popover.vue', () => ({
  default: { template: '<div><slot name="button" /><slot /></div>' }
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: { template: '<button><slot /></button>' }
}))

vi.mock('@/platform/cloud/subscription/components/SubscribeToRun.vue', () => ({
  default: { template: '<div data-testid="subscribe-to-run">Subscribe</div>' }
}))

vi.mock('./PartnerNodesList.vue', () => ({
  default: { template: '<div data-testid="partner-nodes"></div>' }
}))

describe('LinearControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessSubscriptionFeatures.value = true
  })

  function renderComponent(props: { mobile?: boolean } = {}) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return render(LinearControls, {
      global: {
        plugins: [i18n]
      },
      props
    })
  }

  describe('canAccessSubscriptionFeatures', () => {
    it('hides SubscribeToRunButton when canAccessSubscriptionFeatures is true', () => {
      mockCanAccessSubscriptionFeatures.value = true
      renderComponent()

      expect(screen.queryByTestId('subscribe-to-run')).not.toBeInTheDocument()
    })

    it('shows SubscribeToRunButton when canAccessSubscriptionFeatures is false', () => {
      mockCanAccessSubscriptionFeatures.value = false
      renderComponent()

      expect(screen.getByTestId('subscribe-to-run')).toBeInTheDocument()
    })

    it('shows SubscribeToRunButton on mobile when canAccessSubscriptionFeatures is false', () => {
      mockCanAccessSubscriptionFeatures.value = false
      renderComponent({ mobile: true })

      expect(screen.getByTestId('subscribe-to-run')).toBeInTheDocument()
    })

    it('hides SubscribeToRunButton on mobile when canAccessSubscriptionFeatures is true', () => {
      mockCanAccessSubscriptionFeatures.value = true
      renderComponent({ mobile: true })

      expect(screen.queryByTestId('subscribe-to-run')).not.toBeInTheDocument()
    })
  })
})
