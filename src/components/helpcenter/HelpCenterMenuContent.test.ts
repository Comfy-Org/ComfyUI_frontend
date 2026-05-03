import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import HelpCenterMenuContent from './HelpCenterMenuContent.vue'

const distribution = vi.hoisted(() => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false
}))

const commandStoreExecute = vi.hoisted(() => vi.fn())

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return distribution.isDesktop
  },
  get isNightly() {
    return distribution.isNightly
  }
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    staticUrls: { discord: '', github: '' },
    buildDocsUrl: () => 'https://docs.comfy.org'
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: () => false
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackHelpResourceClicked: vi.fn(),
    trackHelpCenterOpened: vi.fn(),
    trackHelpCenterClosed: vi.fn()
  })
}))

vi.mock('@/platform/updates/common/releaseStore', () => ({
  useReleaseStore: () => ({
    releases: [],
    recentReleases: [],
    isLoading: false,
    fetchReleases: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: commandStoreExecute })
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => null
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictAcknowledgment',
  () => ({
    useConflictAcknowledgment: () => ({ shouldShowRedDot: { value: false } })
  })
)

vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: () => ({ isNewManagerUI: { value: false } })
}))

vi.mock('@/workbench/extensions/manager/services/comfyManagerService', () => ({
  useComfyManagerService: () => ({})
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

vi.mock('@/components/icons/PuzzleIcon.vue', () => ({
  default: defineComponent({
    name: 'PuzzleIconStub',
    render: () => h('div')
  })
}))

function renderComponent() {
  const user = userEvent.setup()
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  const result = render(HelpCenterMenuContent, {
    global: {
      plugins: [i18n]
    }
  })

  return { user, ...result }
}

describe('HelpCenterMenuContent feedback item', () => {
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    distribution.isNightly = false
    commandStoreExecute.mockReset()
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
  })

  afterEach(() => {
    openSpy.mockRestore()
    cleanup()
  })

  it('opens the Typeform survey tagged with help-center source on Cloud', async () => {
    distribution.isCloud = true
    const { user } = renderComponent()

    await user.click(screen.getByTestId('help-menu-item-feedback'))

    expect(openSpy).toHaveBeenCalledWith(
      'https://form.typeform.com/to/q7azbWPi#distribution=ccloud&source=help-center',
      '_blank',
      'noopener,noreferrer'
    )
    expect(commandStoreExecute).not.toHaveBeenCalled()
  })

  it('opens the Typeform survey tagged with help-center source on Nightly', async () => {
    distribution.isNightly = true
    const { user } = renderComponent()

    await user.click(screen.getByTestId('help-menu-item-feedback'))

    expect(openSpy).toHaveBeenCalledWith(
      'https://form.typeform.com/to/q7azbWPi#distribution=oss-nightly&source=help-center',
      '_blank',
      'noopener,noreferrer'
    )
    expect(commandStoreExecute).not.toHaveBeenCalled()
  })

  it('falls back to Comfy.ContactSupport on OSS builds', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByTestId('help-menu-item-feedback'))

    expect(openSpy).not.toHaveBeenCalled()
    expect(commandStoreExecute).toHaveBeenCalledWith('Comfy.ContactSupport')
  })
})
