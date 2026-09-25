import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { useToast } from '@/components/ui/toast'
import * as registry from '@/services/comfyRegistryService'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

import PackUpdateButton from './PackUpdateButton.vue'

const pack: components['schemas']['Node'] = {
  id: 'sample-pack',
  repository: 'https://github.com/example/sample-pack',
  latest_version: { version: '1.1.0', status: 'NodeVersionStatusActive' }
}

function renderButton(nodePacks = [pack]) {
  return render(PackUpdateButton, {
    props: { nodePacks },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      directives: { tooltip: {} }
    }
  })
}

beforeEach(async () => {
  const manager = useComfyManagerStore()
  manager.installedPacks = {
    'sample-pack': { cnr_id: 'sample-pack', ver: '1.0.0', enabled: true }
  }
  await nextTick()
  vi.spyOn(manager.installPack, 'call').mockResolvedValue(undefined)
  vi.spyOn(manager.updatePack, 'call').mockResolvedValue(undefined)
})

it('switches to the registry-selected Active version by default', async () => {
  const service = registry.useComfyRegistryService()
  vi.spyOn(service, 'getPackVersions').mockResolvedValue([
    { version: '1.1.0', status: 'NodeVersionStatusActive' }
  ])
  vi.spyOn(registry, 'useComfyRegistryService').mockReturnValue(service)
  renderButton()

  await userEvent.click(screen.getByRole('button', { name: 'Update' }))

  await waitFor(() => {
    expect(useComfyManagerStore().installPack.call).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sample-pack',
        version: '1.1.0',
        selected_version: '1.1.0'
      })
    )
  })
  expect(service.getPackVersions).toHaveBeenCalledWith('sample-pack', {
    statuses: ['NodeVersionStatusActive']
  })
  expect(useComfyManagerStore().updatePack.call).not.toHaveBeenCalled()
})

it('offers an explicit switch to the latest installable version, including Flagged', async () => {
  const service = registry.useComfyRegistryService()
  vi.spyOn(service, 'getPackVersions').mockResolvedValue([
    { version: '1.2.0', status: 'NodeVersionStatusFlagged' },
    { version: '1.1.0', status: 'NodeVersionStatusActive' }
  ])
  vi.spyOn(registry, 'useComfyRegistryService').mockReturnValue(service)
  renderButton()

  await userEvent.click(screen.getByRole('button', { name: 'Update options' }))
  await userEvent.click(
    await screen.findByRole('menuitem', { name: 'Latest Installable' })
  )

  await waitFor(() => {
    expect(useComfyManagerStore().installPack.call).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sample-pack',
        version: '1.2.0',
        selected_version: '1.2.0'
      })
    )
  })
  expect(service.getPackVersions).toHaveBeenCalledWith('sample-pack', {
    statuses: [
      'NodeVersionStatusActive',
      'NodeVersionStatusFlagged',
      'NodeVersionStatusPending'
    ]
  })
})

it.for([
  { name: 'no eligible release', versions: [], severity: 'warn' },
  { name: 'registry failure', versions: null, severity: 'error' }
])('does not install and reports $name', async ({ versions, severity }) => {
  const service = registry.useComfyRegistryService()
  vi.spyOn(service, 'getPackVersions').mockResolvedValue(versions)
  vi.spyOn(registry, 'useComfyRegistryService').mockReturnValue(service)
  renderButton()

  await userEvent.click(screen.getByRole('button', { name: 'Update' }))

  await waitFor(() => {
    expect(
      useToast()[severity === 'warn' ? 'warning' : 'error']
    ).toHaveBeenCalled()
  })
  expect(useComfyManagerStore().installPack.call).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()
})

it('does not re-enable disabled packs during a batch switch', async () => {
  const manager = useComfyManagerStore()
  manager.installedPacks['disabled-pack'] = {
    cnr_id: 'disabled-pack',
    ver: '1.0.0',
    enabled: false
  }
  await nextTick()
  const service = registry.useComfyRegistryService()
  vi.spyOn(service, 'getPackVersions').mockResolvedValue([
    { version: '1.1.0', status: 'NodeVersionStatusActive' }
  ])
  vi.spyOn(registry, 'useComfyRegistryService').mockReturnValue(service)
  renderButton([pack, { ...pack, id: 'disabled-pack' }])

  await userEvent.click(screen.getByRole('button', { name: 'Update All' }))

  await waitFor(() => {
    expect(manager.installPack.call).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: 'sample-pack', selected_version: '1.1.0' })
    )
  })
})

it('skips switching when the selected version is already installed', async () => {
  const manager = useComfyManagerStore()
  manager.installedPacks['sample-pack'].ver = '1.1.0'
  const service = registry.useComfyRegistryService()
  vi.spyOn(service, 'getPackVersions').mockResolvedValue([
    { version: '1.1.0', status: 'NodeVersionStatusActive' }
  ])
  vi.spyOn(registry, 'useComfyRegistryService').mockReturnValue(service)
  renderButton()

  await userEvent.click(screen.getByRole('button', { name: 'Update' }))

  await waitFor(() => {
    expect(useToast().info).toHaveBeenCalled()
  })
  expect(manager.installPack.call).not.toHaveBeenCalled()
})
