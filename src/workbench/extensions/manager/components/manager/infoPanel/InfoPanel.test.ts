import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'

import InfoPanel from './InfoPanel.vue'
import InfoPanelMultiItem from './InfoPanelMultiItem.vue'

const pack: components['schemas']['Node'] = {
  id: 'failed-pack',
  name: 'Failed pack',
  status: 'NodeStatusActive',
  latest_version: { version: '1.0.0', status: 'NodeVersionStatusActive' }
}

it('keeps update options available when the latest Active version is installed', () => {
  const manager = useComfyManagerStore()
  vi.mocked(manager.isPackInstalled).mockReturnValue(true)
  vi.mocked(manager.isPackEnabled).mockReturnValue(true)
  vi.mocked(manager.isPackInstalling).mockReturnValue(false)
  vi.mocked(manager.getInstalledPackVersion).mockReturnValue('1.0.0')
  vi.spyOn(useComfyRegistryStore().getNodeDefs, 'call').mockResolvedValue({
    comfy_nodes: []
  })

  render(InfoPanel, {
    props: { nodePack: pack },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      directives: { tooltip: {} }
    }
  })

  expect(screen.getByRole('button', { name: 'Update options' })).toBeEnabled()
})

it.for([
  { name: 'single selection', component: InfoPanel, props: { nodePack: pack } },
  {
    name: 'multiple selection',
    component: InfoPanelMultiItem,
    props: { nodePacks: [pack, { ...pack, id: 'other-pack' }] }
  }
])(
  'preserves import failure status for $name',
  async ({ component, props }) => {
    const manager = useComfyManagerStore()
    vi.mocked(manager.isPackInstalled).mockReturnValue(true)
    vi.mocked(manager.getInstalledPackVersion).mockReturnValue('1.0.0')
    vi.spyOn(useComfyRegistryStore().getNodeDefs, 'call').mockResolvedValue({
      comfy_nodes: []
    })
    useConflictDetectionStore().setConflictedPackages([
      {
        package_id: 'failed-pack',
        package_name: 'Failed pack',
        has_conflict: true,
        is_compatible: false,
        conflicts: [
          {
            type: 'import_failed',
            current_value: 'failed',
            required_value: 'loaded'
          }
        ]
      }
    ])

    render(component, {
      props,
      global: {
        plugins: [
          createI18n({ legacy: false, locale: 'en', messages: { en } })
        ],
        directives: { tooltip: {} }
      }
    })

    expect(
      await screen.findByText(en.manager.status.importFailed)
    ).toBeVisible()
    useConflictDetectionStore().clearConflicts()
    await nextTick()
    expect(
      screen.queryByText(en.manager.status.importFailed)
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(en.manager.status.active, { exact: true })
    ).toBeVisible()
  }
)
