import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import enCommands from '@/locales/en/commands.json' with { type: 'json' }
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useReleaseStore } from '@/platform/updates/common/releaseStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'

import HelpCenterMenuContent from './HelpCenterMenuContent.vue'

beforeEach(() => {
  managerState.isNewManagerUI.value = false
  useManagerState().isNewManagerUI = computed(
    () => managerState.isNewManagerUI.value
  )
  vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
  vi.mocked(useReleaseStore().fetchReleases).mockResolvedValue(undefined)
})

const distribution = vi.hoisted(() => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false
}))

const managerState = vi.hoisted(() => ({ isNewManagerUI: { value: false } }))
const addToast = vi.hoisted(() => vi.fn())

vi.mock(import('@/platform/distribution/types'), () => ({
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

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(import('@/utils/envUtil'), () => ({
  electronAPI: () => null
}))

vi.mock<unknown>(
  import('@/workbench/extensions/manager/composables/useConflictAcknowledgment'),

  () => ({
    useConflictAcknowledgment: () => ({ shouldShowRedDot: { value: false } })
  })
)

vi.mock(import('@/workbench/extensions/manager/composables/useManagerState'))

vi.mock<unknown>(
  import('primevue/usetoast'), // eslint-disable-line primevue-removal/no-imports

  () => ({
    useToast: () => ({ add: addToast })
  })
)

vi.mock(import('@/components/icons/PuzzleIcon.vue'), () => ({
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
    messages: { en: { ...enMessages, commands: enCommands } }
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
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
  })

  afterEach(() => {
    openSpy.mockRestore()
  })

  it('opens the Typeform survey tagged with help-center source on Cloud', async () => {
    distribution.isCloud = true
    const { user } = renderComponent()

    await user.click(screen.getByRole('menuitem', { name: 'Give Feedback' }))

    expect(openSpy).toHaveBeenCalledWith(
      'https://form.typeform.com/to/q7azbWPi#distribution=ccloud&source=help-center',
      '_blank',
      'noopener,noreferrer'
    )
    expect(useCommandStore().execute).not.toHaveBeenCalled()
  })

  it('opens the Typeform survey tagged with help-center source on Nightly', async () => {
    distribution.isNightly = true
    const { user } = renderComponent()

    await user.click(screen.getByRole('menuitem', { name: 'Give Feedback' }))

    expect(openSpy).toHaveBeenCalledWith(
      'https://form.typeform.com/to/q7azbWPi#distribution=oss-nightly&source=help-center',
      '_blank',
      'noopener,noreferrer'
    )
    expect(useCommandStore().execute).not.toHaveBeenCalled()
  })

  it('falls back to Comfy.ContactSupport on OSS builds', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByRole('menuitem', { name: 'Give Feedback' }))

    expect(openSpy).not.toHaveBeenCalled()
    expect(useCommandStore().execute).toHaveBeenCalledWith(
      'Comfy.ContactSupport'
    )
  })
})

describe('HelpCenterMenuContent system status item', () => {
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    distribution.isNightly = false
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
  })

  afterEach(() => {
    openSpy.mockRestore()
  })

  it('opens the status page on Cloud', async () => {
    distribution.isCloud = true
    const { user } = renderComponent()

    await user.click(screen.getByRole('menuitem', { name: 'System Status' }))

    expect(openSpy).toHaveBeenCalledWith(
      'https://status.comfy.org/',
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('is hidden outside Cloud', () => {
    renderComponent()

    expect(screen.queryByRole('menuitem', { name: 'System Status' })).toBeNull()
  })
})

describe('HelpCenterMenuContent onboarding replay', () => {
  it('is hidden outside developer mode', async () => {
    distribution.isDesktop = true
    useSettingStore().settingValues['Comfy.DevMode'] = false
    const { user } = renderComponent()

    await user.hover(screen.getByRole('menuitem', { name: 'More...' }))

    expect(
      screen.queryByRole('menuitem', { name: 'Replay Onboarding' })
    ).toBeNull()
  })

  it('runs the replay command and closes the help center', async () => {
    useSettingStore().settingValues['Comfy.DevMode'] = true
    const { user, emitted } = renderComponent()

    await user.hover(screen.getByRole('menuitem', { name: 'More...' }))
    await user.click(
      screen.getByRole('menuitem', { name: 'Replay Onboarding' })
    )

    expect(useCommandStore().execute).toHaveBeenCalledWith(
      'Comfy.Onboarding.Replay'
    )
    expect(emitted().close).toHaveLength(1)
  })
})

describe('HelpCenterMenuContent ComfyUI update', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    managerState.isNewManagerUI.value = true
  })

  it('starts accepted update work before requesting a reboot', async () => {
    const request = vi
      .spyOn(axios.Axios.prototype, 'request')
      .mockResolvedValue({ data: '' })
    const { user } = renderComponent()

    await user.click(screen.getByRole('menuitem', { name: 'Update ComfyUI' }))

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'post', url: 'manager/reboot' })
      )
    })
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        url: 'manager/queue/update_comfyui',
        params: expect.objectContaining({ is_stable: true })
      })
    )
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'post', url: 'manager/queue/start' })
    )
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it.for([
    { name: 'submission', url: 'manager/queue/update_comfyui' },
    { name: 'queue startup', url: 'manager/queue/start' }
  ])('reports $name failure without rebooting', async ({ url }) => {
    const request = vi
      .spyOn(axios.Axios.prototype, 'request')
      .mockImplementation(async (config) => {
        if (config.url === url) throw new Error('Update request rejected')
        return { data: '' }
      })
    const { user } = renderComponent()

    await user.click(screen.getByRole('menuitem', { name: 'Update ComfyUI' }))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: expect.stringContaining('Update request rejected')
        })
      )
    })
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: 'manager/reboot' })
    )
    expect(addToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })
})
