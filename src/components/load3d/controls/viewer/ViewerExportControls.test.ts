import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ViewerExportControls from '@/components/load3d/controls/viewer/ViewerExportControls.vue'

vi.mock('@/components/ui/select/Select.vue', () => ({
  default: {
    name: 'Select',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    provide(this: {
      modelValue: string
      $emit: (event: string, ...args: unknown[]) => void
    }) {
      return {
        selectModelValue: (): string => this.modelValue,
        selectUpdate: (v: string) => this.$emit('update:modelValue', v)
      }
    },
    template: '<div><slot /></div>'
  }
}))

vi.mock('@/components/ui/select/SelectContent.vue', () => ({
  default: {
    name: 'SelectContent',
    inject: ['selectUpdate'],
    template:
      '<select @change="selectUpdate($event.target.value)"><slot /></select>'
  }
}))

vi.mock('@/components/ui/select/SelectItem.vue', () => ({
  default: {
    name: 'SelectItem',
    props: ['value'],
    inject: ['selectModelValue'],
    computed: {
      isSelected(this: {
        selectModelValue: () => string
        value: string
      }): boolean {
        return this.selectModelValue() === this.value
      }
    },
    template: '<option :value="value" :selected="isSelected"><slot /></option>'
  }
}))

vi.mock('@/components/ui/select/SelectTrigger.vue', () => ({
  default: { name: 'SelectTrigger', template: '<span />' }
}))

vi.mock('@/components/ui/select/SelectValue.vue', () => ({
  default: { name: 'SelectValue', template: '<span />' }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { load3d: { export: 'Export' } } }
})

function renderComponent(onExportModel?: (format: string) => void) {
  const utils = render(ViewerExportControls, {
    props: { onExportModel },
    global: { plugins: [i18n] }
  })
  return { ...utils, user: userEvent.setup() }
}

describe('ViewerExportControls', () => {
  it('renders all three export format options', () => {
    renderComponent()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const optionValues = Array.from(select.options).map((o) => o.value)

    expect(optionValues).toEqual(['glb', 'obj', 'stl'])
  })

  it('defaults the export format to obj', () => {
    renderComponent()
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(
      'obj'
    )
  })

  it('emits exportModel with the currently selected format when the button is clicked', async () => {
    const onExportModel = vi.fn()
    const { user } = renderComponent(onExportModel)

    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onExportModel).toHaveBeenCalledWith('obj')
  })

  it('emits the newly chosen format after the user changes the dropdown', async () => {
    const onExportModel = vi.fn()
    const { user } = renderComponent(onExportModel)

    await user.selectOptions(screen.getByRole('combobox'), 'glb')
    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onExportModel).toHaveBeenCalledWith('glb')
  })
})
