import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComponentWidget } from '@/scripts/domWidget'

import MultiSelectWidget from './MultiSelectWidget.vue'

function makeWidget(
  inputSpec: Partial<ComboInputSpec>
): ComponentWidget<string[]> {
  return {
    name: 'multi',
    inputSpec: {
      type: 'COMBO',
      name: 'multi',
      ...inputSpec
    } as ComboInputSpec
  } as unknown as ComponentWidget<string[]>
}

function renderWidget(
  inputSpec: Partial<ComboInputSpec>,
  initialValue: string[] = []
) {
  const value = ref(initialValue)
  const widget = makeWidget(inputSpec)
  const Harness = defineComponent({
    components: { MultiSelectWidget },
    setup: () => ({ value, widget }),
    template: '<MultiSelectWidget v-model="value" :widget="widget" />'
  })
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return { ...render(Harness, { global: { plugins: [i18n] } }), value }
}

describe('MultiSelectWidget', () => {
  it('commits selected option values to the widget model', async () => {
    const user = userEvent.setup()
    const { value } = renderWidget(
      {
        options: ['a', 'b'],
        multi_select: { placeholder: 'Pick items' }
      },
      ['a']
    )

    await user.click(screen.getByRole('button', { name: 'Pick items' }))
    await user.click(screen.getByRole('option', { name: 'b' }))

    expect(value.value).toEqual(['a', 'b'])
  })

  it('supports keyboard selection', async () => {
    const user = userEvent.setup()
    const { value } = renderWidget({ options: ['a', 'b'] })

    await user.click(screen.getByRole('button', { name: 'Select items' }))
    await user.keyboard('{ArrowDown}{Enter}')

    expect(value.value).toEqual(['b'])
  })
})
