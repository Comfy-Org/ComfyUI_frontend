import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ServerConfigPanel from './ServerConfigPanel.vue'
import type * as Pinia from 'pinia'

const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const mockSettingStore = vi.hoisted(() => ({
  set: vi.fn()
}))

const mockToastStore = vi.hoisted(() => ({
  add: vi.fn()
}))

const mockCopy = vi.hoisted(() => vi.fn())

const mockElectronAPI = vi.hoisted(() => ({
  restartApp: vi.fn()
}))

const mockServerConfigStore = vi.hoisted(() => ({
  refs: null as null | {
    serverConfigsByCategory: {
      value: Record<
        string,
        Array<{
          id: string
          name: string
          value: string
          initialValue: string
          tooltip?: string
        }>
      >
    }
    serverConfigValues: { value: Record<string, string> }
    launchArgs: { value: string[] }
    commandLineArgs: { value: string }
    modifiedConfigs: {
      value: Array<{
        id: string
        name: string
        value: string
        initialValue: string
      }>
    }
  },
  revertChanges: vi.fn()
}))

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof Pinia>()
  return {
    ...actual,
    storeToRefs: (store: object) => store
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => mockToastStore
}))

vi.mock('@/stores/serverConfigStore', async () => {
  const { ref } = await import('vue')

  const serverConfigsByCategory = ref({
    general: [
      {
        id: 'listen',
        name: 'Listen',
        value: 'true',
        initialValue: 'false',
        tooltip: 'Enable listen mode'
      },
      {
        id: 'preview',
        name: 'Preview',
        value: 'auto',
        initialValue: 'auto'
      }
    ]
  })
  const serverConfigValues = ref({ listen: 'true' })
  const launchArgs = ref(['--listen'])
  const commandLineArgs = ref('python main.py --listen')
  const modifiedConfigs = ref([
    {
      id: 'listen',
      name: 'Listen',
      value: 'true',
      initialValue: 'false'
    }
  ])

  mockServerConfigStore.refs = {
    serverConfigsByCategory,
    serverConfigValues,
    launchArgs,
    commandLineArgs,
    modifiedConfigs
  }

  return {
    useServerConfigStore: () => ({
      serverConfigsByCategory,
      serverConfigValues,
      launchArgs,
      commandLineArgs,
      modifiedConfigs,
      revertChanges: mockServerConfigStore.revertChanges
    })
  }
})

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: mockCopy
  })
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => mockElectronAPI
}))

vi.mock('@/components/common/FormItem.vue', () => ({
  default: {
    props: ['id', 'item', 'labelClass'],
    template: `
      <label
        :data-testid="'server-config-' + id"
        :data-highlighted="String(Boolean(labelClass?.['text-highlight']))"
        :title="item.tooltip"
      >
        {{ item.name }}={{ item.value }}
      </label>
    `
  }
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    props: ['ariaLabel'],
    emits: ['click'],
    template: `
      <button type="button" :aria-label="ariaLabel" @click="$emit('click')">
        <slot />
      </button>
    `
  }
}))

vi.mock('primevue/divider', () => ({
  default: {
    template: '<hr />'
  }
}))

vi.mock('primevue/message', () => ({
  default: {
    template: '<section><slot name="icon" /><slot /></section>'
  }
}))

function renderPanel() {
  return render(ServerConfigPanel, {
    global: {
      plugins: [testI18n]
    }
  })
}

describe('ServerConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingStore.set.mockResolvedValue(undefined)
    mockCopy.mockResolvedValue(undefined)
    mockElectronAPI.restartApp.mockResolvedValue(undefined)
    mockServerConfigStore.revertChanges.mockReset()
    if (mockServerConfigStore.refs) {
      mockServerConfigStore.refs.serverConfigsByCategory.value = {
        general: [
          {
            id: 'listen',
            name: 'Listen',
            value: 'true',
            initialValue: 'false',
            tooltip: 'Enable listen mode'
          },
          {
            id: 'preview',
            name: 'Preview',
            value: 'auto',
            initialValue: 'auto'
          }
        ]
      }
      mockServerConfigStore.refs.serverConfigValues.value = { listen: 'true' }
      mockServerConfigStore.refs.launchArgs.value = ['--listen']
      mockServerConfigStore.refs.commandLineArgs.value =
        'python main.py --listen'
      mockServerConfigStore.refs.modifiedConfigs.value = [
        {
          id: 'listen',
          name: 'Listen',
          value: 'true',
          initialValue: 'false'
        }
      ]
    }
  })

  it('renders modified configs, translates form items, and copies command line args', async () => {
    const user = userEvent.setup()
    renderPanel()

    expect(screen.getByText('serverConfig.modifiedConfigs')).toBeInTheDocument()
    expect(screen.getByText('Listen: false → true')).toBeInTheDocument()
    expect(screen.getByTestId('server-config-listen')).toHaveAttribute(
      'data-highlighted',
      'true'
    )
    expect(screen.getByTestId('server-config-listen')).toHaveAttribute(
      'title',
      'Enable listen mode'
    )
    expect(screen.getByTestId('server-config-preview')).toHaveAttribute(
      'data-highlighted',
      'false'
    )

    await user.click(screen.getByLabelText('g.copyToClipboard'))

    expect(mockCopy).toHaveBeenCalledWith('python main.py --listen')
  })

  it('reverts, restarts, and suppresses the unmount warning after restart', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPanel()

    await user.click(
      screen.getByRole('button', { name: 'serverConfig.revertChanges' })
    )
    expect(mockServerConfigStore.revertChanges).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', { name: 'serverConfig.restart' })
    )
    expect(mockElectronAPI.restartApp).toHaveBeenCalledTimes(1)

    unmount()

    expect(mockToastStore.add).not.toHaveBeenCalled()
  })

  it('persists launch args and server config values through watchers', async () => {
    renderPanel()

    if (!mockServerConfigStore.refs) {
      throw new Error('server config refs were not initialized')
    }

    mockServerConfigStore.refs.launchArgs.value = ['--cpu']
    await nextTick()
    mockServerConfigStore.refs.serverConfigValues.value = { listen: 'false' }
    await nextTick()

    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.Server.LaunchArgs',
      ['--cpu']
    )
    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.Server.ServerConfigValues',
      { listen: 'false' }
    )
  })

  it('warns on unmount only when modified configs remain', () => {
    if (!mockServerConfigStore.refs) {
      throw new Error('server config refs were not initialized')
    }

    mockServerConfigStore.refs.modifiedConfigs.value = []
    const empty = renderPanel()
    empty.unmount()
    expect(mockToastStore.add).not.toHaveBeenCalled()

    mockServerConfigStore.refs.modifiedConfigs.value = [
      {
        id: 'listen',
        name: 'Listen',
        value: 'true',
        initialValue: 'false'
      }
    ]
    const modified = renderPanel()
    modified.unmount()

    expect(mockToastStore.add).toHaveBeenCalledWith({
      severity: 'warn',
      summary: 'serverConfig.restartRequiredToastSummary',
      detail: 'serverConfig.restartRequiredToastDetail',
      life: 10_000
    })
  })
})
