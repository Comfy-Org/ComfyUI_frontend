import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/platform/customNodes/manager/stores/conflictDetectionStore'

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
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
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
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
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

const invalidPack: components['schemas']['Node'] = {
  id: 'invalid-pack',
  name: 'Invalid pack',
  status: 'NodeStatusActive',
  latest_version: { version: '1.0.0', status: 'NodeVersionStatusActive' }
}

function mockInstalledPacks(versions: Record<string, string>) {
  const manager = useComfyManagerStore()
  vi.mocked(manager.isPackInstalled).mockReturnValue(true)
  vi.mocked(manager.isPackEnabled).mockReturnValue(true)
  vi.mocked(manager.isPackInstalling).mockReturnValue(false)
  vi.mocked(manager.isPackInvalidInstallation).mockImplementation(
    (id) => id === invalidPack.id
  )
  vi.mocked(manager.getInstalledPackVersion).mockImplementation(
    (id) => versions[id]
  )
  vi.spyOn(useComfyRegistryStore().getNodeDefs, 'call').mockResolvedValue({
    comfy_nodes: []
  })
}

it('offers Reinstall as the only action for an invalid installation', () => {
  mockInstalledPacks({ 'invalid-pack': 'unknown' })

  render(InfoPanel, {
    props: { nodePack: invalidPack },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })

  expect(screen.getByText(en.manager.invalidInstallation.message)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reinstall' })).toBeEnabled()
  expect(screen.getByText(en.manager.status.invalidInstallation)).toBeVisible()
  expect(
    screen.queryByRole('button', { name: en.manager.tryUpdate })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: en.manager.uninstall })
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  expect(screen.queryByText(en.manager.version)).not.toBeInTheDocument()
})

it('offers Reinstall for an invalid installation that also failed to import', async () => {
  mockInstalledPacks({ 'invalid-pack': 'unknown' })
  useConflictDetectionStore().setConflictedPackages([
    {
      package_id: 'invalid-pack',
      package_name: 'Invalid pack',
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

  render(InfoPanel, {
    props: { nodePack: invalidPack },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })

  expect(await screen.findByText(en.manager.status.importFailed)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reinstall' })).toBeEnabled()
})

it('does not offer a nightly update for an invalid installation in a multiple selection', () => {
  mockInstalledPacks({ 'invalid-pack': 'unknown', 'valid-pack': '1.0.0' })

  render(InfoPanelMultiItem, {
    props: { nodePacks: [invalidPack, { ...invalidPack, id: 'valid-pack' }] },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })

  expect(
    screen.queryByRole('button', { name: en.manager.updateSelected })
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: en.manager.uninstallSelected })
  ).toBeVisible()
})

it('shows the invalid installation status for a multiple selection that includes one', () => {
  mockInstalledPacks({ 'invalid-pack': 'unknown', 'valid-pack': '1.0.0' })

  render(InfoPanelMultiItem, {
    props: { nodePacks: [invalidPack, { ...invalidPack, id: 'valid-pack' }] },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })

  expect(screen.getByText(en.manager.status.invalidInstallation)).toBeVisible()
  expect(
    screen.queryByText(en.manager.status.active, { exact: true })
  ).not.toBeInTheDocument()
})
