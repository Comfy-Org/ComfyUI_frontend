import { render } from '@testing-library/vue'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { testI18n } from '@/utils/__tests__/testI18n'

import { useAgentExtensionNotices } from './useAgentExtensionNotices'

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
  it('waits for late registration to settle, then remembers and announces it', async () => {
    const extensionStore = useExtensionStore()
    const settingStore = useSettingStore()
    const setSetting = vi.spyOn(settingStore, 'set').mockResolvedValue()
    extensionStore.holdNewExtensions()
    renderNotices()

    extensionStore.registerExtension({
      name: 'agent.tools.sidebar',
      provenance: {
        createdBy: 'comfy-agent',
        summary: 'Adds a tools sidebar'
      }
    })
    await nextTick()
    expect(useToast().toasts).toEqual([])

    extensionStore.finishLateExtensions()
    await nextTick()

    expect(useToast().toasts[0]).toMatchObject({
      title: 'Your agent added agent.tools.sidebar',
      description: 'Adds a tools sidebar'
    })
    expect(useToast().toasts[0].actions.map(({ label }) => label)).toEqual([
      'Manage extensions',
      'Disable extension'
    ])
    expect(setSetting).toHaveBeenCalledWith(
      'Comfy.Extension.SeenAgentExtensions',
      ['agent.tools.sidebar']
    )
  })

  it('does not announce an extension already persisted as seen', async () => {
    const extensionStore = useExtensionStore()
    vi.spyOn(useSettingStore(), 'get').mockImplementation((key) =>
      key === 'Comfy.Extension.SeenAgentExtensions'
        ? ['agent.tools.sidebar']
        : []
    )
    extensionStore.registerExtension({ name: 'agent.tools.sidebar' })

    renderNotices()
    await nextTick()

    expect(useToast().toasts).toEqual([])
  })
})
