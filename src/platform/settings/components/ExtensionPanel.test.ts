import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ExtensionPanel from './ExtensionPanel.vue'

const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

interface MockExtension {
  name: string
}

const mockSettingStore = vi.hoisted(() => ({
  set: vi.fn()
}))

const mockExtensionState = vi.hoisted(() => ({
  store: {
    extensions: [
      { name: 'core.color' },
      { name: 'custom.pack' },
      { name: 'readonly.pack' }
    ] as MockExtension[],
    inactiveDisabledExtensionNames: ['inactive.pack'],
    hasThirdPartyExtensions: true,
    enabled: new Set(['core.color', 'custom.pack', 'readonly.pack']),
    core: new Set(['core.color']),
    readOnly: new Set(['readonly.pack']),
    isExtensionEnabled(name: string) {
      return this.enabled.has(name)
    },
    isCoreExtension(name: string) {
      return this.core.has(name)
    },
    isExtensionReadOnly(name: string) {
      return this.readOnly.has(name)
    }
  }
}))

vi.mock('@primevue/core/api', () => ({
  FilterMatchMode: {
    CONTAINS: 'contains'
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => mockExtensionState.store
}))

vi.mock('@/components/ui/search-input/SearchInput.vue', () => ({
  default: {
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template: `
      <input
        data-testid="extension-search"
        :value="modelValue"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
      />
    `
  }
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    props: ['disabled'],
    emits: ['click'],
    template: `
      <button type="button" :disabled="disabled" @click="$emit('click', $event)">
        <slot />
      </button>
    `
  }
}))

vi.mock('primevue/message', () => ({
  default: {
    template: '<section data-testid="extension-message"><slot /></section>'
  }
}))

vi.mock('primevue/selectbutton', () => ({
  default: {
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    template: `
      <div data-testid="extension-filter">
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          @click="$emit('update:modelValue', option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    `
  }
}))

vi.mock('primevue/datatable', () => ({
  default: {
    props: ['value', 'selection'],
    emits: ['update:selection'],
    template: `
      <section data-testid="extension-table">
        <button
          type="button"
          data-testid="select-visible"
          @click="$emit('update:selection', value)"
        >
          select
        </button>
        <div v-for="ext in value" :key="ext.name" data-testid="extension-row">
          {{ ext.name }}
        </div>
        <slot />
      </section>
    `
  }
}))

vi.mock('primevue/column', () => ({
  default: {
    template: '<div><slot name="header" /><slot /></div>'
  }
}))

vi.mock('primevue/contextmenu', () => ({
  default: {
    props: ['model'],
    methods: {
      show: vi.fn()
    },
    template: `
      <div data-testid="extension-menu">
        <button
          v-for="item in model.filter((entry) => !entry.separator)"
          :key="item.label"
          type="button"
          :disabled="item.disabled"
          @click="item.command?.()"
        >
          {{ item.label }}
        </button>
      </div>
    `
  }
}))

vi.mock('primevue/tag', () => ({
  default: {
    props: ['value'],
    template: '<span>{{ value }}</span>'
  }
}))

vi.mock('primevue/toggleswitch', () => ({
  default: {
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue', 'change'],
    template: `
      <button
        type="button"
        :disabled="disabled"
        data-testid="extension-toggle"
        @click="$emit('update:modelValue', !modelValue); $emit('change')"
      >
        {{ String(modelValue) }}
      </button>
    `
  }
}))

function renderPanel() {
  return render(ExtensionPanel, {
    global: {
      plugins: [testI18n]
    }
  })
}

describe('ExtensionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingStore.set.mockResolvedValue(undefined)
    mockExtensionState.store.extensions = [
      { name: 'core.color' },
      { name: 'custom.pack' },
      { name: 'readonly.pack' }
    ]
    mockExtensionState.store.inactiveDisabledExtensionNames = ['inactive.pack']
    mockExtensionState.store.hasThirdPartyExtensions = true
    mockExtensionState.store.enabled = new Set([
      'core.color',
      'custom.pack',
      'readonly.pack'
    ])
    mockExtensionState.store.core = new Set(['core.color'])
    mockExtensionState.store.readOnly = new Set(['readonly.pack'])
  })

  it('filters extensions by all, core, and custom categories', async () => {
    renderPanel()

    expect(screen.getByTestId('extension-table')).toHaveTextContent(
      'core.color'
    )
    expect(screen.getByTestId('extension-table')).toHaveTextContent(
      'custom.pack'
    )

    await userEvent.click(screen.getByRole('button', { name: 'g.core' }))
    expect(screen.getByTestId('extension-table')).toHaveTextContent(
      'core.color'
    )
    expect(screen.getByTestId('extension-table')).not.toHaveTextContent(
      'custom.pack'
    )

    await userEvent.click(screen.getByRole('button', { name: 'g.custom' }))
    expect(screen.getByTestId('extension-table')).not.toHaveTextContent(
      'core.color'
    )
    expect(screen.getByTestId('extension-table')).toHaveTextContent(
      'custom.pack'
    )
    expect(screen.getByTestId('extension-table')).toHaveTextContent(
      'readonly.pack'
    )
  })

  it('applies selected extension commands without changing read-only rows', async () => {
    renderPanel()

    await userEvent.click(screen.getByTestId('select-visible'))
    await userEvent.click(
      screen.getByRole('button', { name: 'g.disableSelected' })
    )

    expect(mockSettingStore.set).toHaveBeenLastCalledWith(
      'Comfy.Extension.Disabled',
      ['inactive.pack', 'core.color', 'custom.pack']
    )
    expect(screen.getByTestId('extension-message')).toHaveTextContent(
      'core.color'
    )
    expect(screen.getByTestId('extension-message')).toHaveTextContent(
      'custom.pack'
    )
    expect(screen.getByTestId('extension-message')).not.toHaveTextContent(
      'readonly.pack'
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'g.enableSelected' })
    )
    expect(mockSettingStore.set).toHaveBeenLastCalledWith(
      'Comfy.Extension.Disabled',
      ['inactive.pack']
    )
  })

  it('applies bulk commands and disables third-party command when unavailable', async () => {
    const { unmount } = renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'g.disableAll' }))
    expect(mockSettingStore.set).toHaveBeenLastCalledWith(
      'Comfy.Extension.Disabled',
      ['inactive.pack', 'core.color', 'custom.pack']
    )

    await userEvent.click(screen.getByRole('button', { name: 'g.enableAll' }))
    expect(mockSettingStore.set).toHaveBeenLastCalledWith(
      'Comfy.Extension.Disabled',
      ['inactive.pack']
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'g.disableThirdParty' })
    )
    expect(mockSettingStore.set).toHaveBeenLastCalledWith(
      'Comfy.Extension.Disabled',
      ['inactive.pack', 'custom.pack', 'readonly.pack']
    )

    unmount()
    mockExtensionState.store.hasThirdPartyExtensions = false
    renderPanel()

    expect(
      screen.getByRole('button', { name: 'g.disableThirdParty' })
    ).toBeDisabled()
  })
})
