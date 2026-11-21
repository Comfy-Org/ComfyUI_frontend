import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { useDialogService } from '@/services/dialogService'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'

import PackReinstallButton from './PackReinstallButton.vue'

vi.mock(import('@/services/dialogService'))

const pack: components['schemas']['Node'] = {
  id: 'comfyui-foo',
  name: 'Foo Pack',
  repository: 'https://github.com/test/comfyui-foo',
  publisher: { id: 'test-publisher', name: 'Test Publisher' },
  latest_version: { version: '1.2.0', status: 'NodeVersionStatusActive' }
}

function renderButton() {
  render(PackReinstallButton, {
    props: { nodePack: pack },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}

it('reinstalls the latest version once the user confirms', async () => {
  const manager = useComfyManagerStore()
  vi.mocked(manager.reinstallPack).mockResolvedValue()
  vi.mocked(useDialogService().confirm).mockResolvedValue(true)
  renderButton()

  await userEvent.click(screen.getByRole('button', { name: 'Reinstall' }))

  expect(useDialogService().confirm).toHaveBeenCalledWith({
    title: 'Reinstall Foo Pack?',
    message:
      'The folder of Foo Pack will be deleted, along with any files you changed in it, and the nodepack will be installed again.',
    type: 'reinstall'
  })
  expect(manager.reinstallPack).toHaveBeenCalledWith({
    id: 'comfyui-foo',
    repository: 'https://github.com/test/comfyui-foo',
    channel: 'dev',
    mode: 'cache',
    version: '1.2.0',
    selected_version: '1.2.0'
  })
})

it('queues nothing when the user closes the confirmation', async () => {
  const manager = useComfyManagerStore()
  vi.mocked(manager.reinstallPack).mockResolvedValue()
  vi.mocked(useDialogService().confirm).mockResolvedValue(null)
  renderButton()

  await userEvent.click(screen.getByRole('button', { name: 'Reinstall' }))

  expect(useDialogService().confirm).toHaveBeenCalledOnce()
  expect(manager.reinstallPack).not.toHaveBeenCalled()
})

it('shows progress while the pack is reinstalling', () => {
  vi.mocked(useComfyManagerStore().isPackInstalling).mockReturnValue(true)
  renderButton()

  expect(screen.getByRole('button', { name: 'Reinstalling' })).toBeDisabled()
})

it('tells the user what happened without naming files of the pack folder', () => {
  const strings = [
    ...Object.values(en.manager.invalidInstallation),
    en.manager.status.invalidInstallation
  ]

  for (const text of strings) expect(text).not.toMatch(/\.git|\.tracking/)
  for (const text of strings) expect(text).not.toMatch(/node\s+pack/i)
})
