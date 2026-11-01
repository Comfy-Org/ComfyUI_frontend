import { render } from '@testing-library/vue'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@comfyorg/settings-core/types'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { testI18n } from '@/utils/__tests__/testI18n'

import { useAgentExtensionNotices } from './useAgentExtensionNotices'

vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'))

function renderNotices() {
  return render(
    {
      setup: useAgentExtensionNotices,
      template: '<div />'
    },
    { global: { plugins: [testI18n] } }
  )
}

describe('useAgentExtensionNotices', () => {
  it('waits for settings and late registration, then announces only unseen extensions', async () => {
    const extensionStore = useExtensionStore()
    const settingStore = useSettingStore()
    const setSetting = vi.spyOn(settingStore, 'set').mockResolvedValue()
    vi.mocked(api.getSettings).mockResolvedValue({
      'Comfy.Extension.SeenAgentExtensions': [
        'agent.tools.seen',
        'agent.absent.toolbar'
      ]
    } as Partial<Settings> as Settings)
    extensionStore.holdNewCustomNodes()
    renderNotices()

    extensionStore.registerExtension({ name: 'agent.tools.seen' })
    extensionStore.registerExtension({
      name: 'agent.tools.new',
      provenance: {
        createdBy: 'comfy-agent',
        summary: 'Adds a tools sidebar'
      }
    })
    await settingStore.load()
    await nextTick()
    expect(useToast().toasts).toEqual([])

    extensionStore.finishLateCustomNodes()
    await nextTick()

    expect(useToast().toasts[0]).toMatchObject({
      title: 'Your agent added agent.tools.new',
      description: 'Adds a tools sidebar'
    })
    expect(useToast().toasts).toHaveLength(1)
    expect(useToast().toasts[0].actions.map(({ label }) => label)).toEqual([
      'Manage extensions',
      'Disable extension'
    ])
    expect(setSetting).toHaveBeenCalledWith(
      'Comfy.Extension.SeenAgentExtensions',
      ['agent.tools.seen', 'agent.absent.toolbar', 'agent.tools.new']
    )
  })

  it('announces nothing before settings arrive, with no late registration hold', async () => {
    const extensionStore = useExtensionStore()
    const settingStore = useSettingStore()
    vi.spyOn(settingStore, 'set').mockResolvedValue()
    vi.mocked(api.getSettings).mockResolvedValue({
      'Comfy.Extension.SeenAgentExtensions': ['agent.tools.early']
    } as Partial<Settings> as Settings)
    extensionStore.registerExtension({ name: 'agent.tools.early' })

    renderNotices()
    await nextTick()

    expect(
      useToast().toasts,
      'announcing on an empty seen history re-announces a seen extension'
    ).toEqual([])

    await settingStore.load()
    await nextTick()

    expect(useToast().toasts).toEqual([])
  })

  it('does not announce an extension already persisted as seen', async () => {
    const extensionStore = useExtensionStore()
    const settingStore = useSettingStore()
    vi.mocked(api.getSettings).mockResolvedValue({} as Settings)
    await settingStore.load()
    settingStore.settingValues['Comfy.Extension.SeenAgentExtensions'] = [
      'agent.tools.sidebar'
    ]
    extensionStore.registerExtension({ name: 'agent.tools.sidebar' })

    renderNotices()
    await nextTick()

    expect(useToast().toasts).toEqual([])
  })

  it('announces an extension when no seen history exists yet', async () => {
    const extensionStore = useExtensionStore()
    const settingStore = useSettingStore()
    const setSetting = vi.spyOn(settingStore, 'set').mockResolvedValue()
    vi.mocked(api.getSettings).mockResolvedValue({} as Settings)
    await settingStore.load()
    extensionStore.registerExtension({ name: 'agent.tools.first' })

    renderNotices()
    await nextTick()

    expect(useToast().toasts[0]).toMatchObject({
      title: 'Your agent added agent.tools.first'
    })
    expect(setSetting).toHaveBeenCalledWith(
      'Comfy.Extension.SeenAgentExtensions',
      ['agent.tools.first']
    )
  })

  it('keeps the page open and reports an explicitly refused disable', async () => {
    const settingStore = useSettingStore()
    vi.mocked(api.getSettings).mockResolvedValue({} as Settings)
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
    vi.when(api.storeSetting)
      .calledWith('Comfy.Extension.Disabled', expect.anything())
      .thenResolve(new Response(null, { status: 403, statusText: 'Forbidden' }))
    await settingStore.load()
    settingStore.settingValues['Comfy.Extension.SeenAgentExtensions'] = []
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()
    renderNotices()

    useExtensionStore().registerExtension({ name: 'agent.tools.sidebar' })
    await nextTick()
    const notice = useToast().toasts[0]
    await notice.actions[1].onClick()

    expect(reload).not.toHaveBeenCalled()
    expect(settingStore.get('Comfy.Extension.Disabled')).toBeUndefined()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: 'Failed to disable extension: 403 Forbidden'
      }),
      {
        surface: 'platform',
        errorType: 'failure_disabling_agent_extension',
        context: { extension_name: 'agent.tools.sidebar' }
      }
    )
    expect(useToast().toasts.at(-1)).toMatchObject({
      kind: 'error',
      title: "Couldn't disable the extension. Try again."
    })
  })
})
