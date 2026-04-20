/* eslint-disable vue/one-component-per-file */
/* eslint-disable vue/no-reserved-component-names */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ControlOptions } from '@/types/simplifiedWidget'

const mockGet = vi.hoisted(() => vi.fn<(key: string) => string>())

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: mockGet })
}))

import ValueControlPopover from './ValueControlPopover.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      widgets: {
        valueControl: {
          header: {
            prefix: 'Automatically update the value',
            before: 'BEFORE',
            after: 'AFTER',
            postfix: 'running the workflow:'
          },
          fixed: 'Fixed Value',
          fixedDesc: 'Leaves value unchanged',
          increment: 'Increment Value',
          incrementDesc: 'Adds 1 to value',
          decrement: 'Decrement Value',
          decrementDesc: 'Subtracts 1 from value',
          randomize: 'Randomize Value',
          randomizeDesc: 'Shuffles the value'
        }
      }
    }
  }
})

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  props: { as: { type: String, default: 'button' } },
  template: '<label v-bind="$attrs" data-testid="option-row"><slot /></label>'
})

function renderPopover(modelValue: ControlOptions = 'randomize') {
  const value = ref<ControlOptions | undefined>(modelValue)
  const Harness = defineComponent({
    components: { ValueControlPopover },
    setup: () => ({ value }),
    template: '<ValueControlPopover v-model="value" />'
  })
  const utils = render(Harness, {
    global: {
      plugins: [PrimeVue, i18n],
      stubs: { Button: ButtonStub }
    }
  })
  return { ...utils, value }
}

describe('ValueControlPopover', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockReturnValue('after')
  })

  describe('Header text from setting store', () => {
    it('shows AFTER copy when Comfy.WidgetControlMode is "after"', () => {
      mockGet.mockReturnValue('after')
      renderPopover()
      expect(screen.getByText('AFTER')).toBeInTheDocument()
      expect(screen.queryByText('BEFORE')).not.toBeInTheDocument()
    })

    it('shows BEFORE copy when Comfy.WidgetControlMode is "before"', () => {
      mockGet.mockReturnValue('before')
      renderPopover()
      expect(screen.getByText('BEFORE')).toBeInTheDocument()
      expect(screen.queryByText('AFTER')).not.toBeInTheDocument()
    })
  })

  describe('Option rendering', () => {
    it('renders all four control options', () => {
      renderPopover()
      expect(screen.getByText('Fixed Value')).toBeInTheDocument()
      expect(screen.getByText('Increment Value')).toBeInTheDocument()
      expect(screen.getByText('Decrement Value')).toBeInTheDocument()
      expect(screen.getByText('Randomize Value')).toBeInTheDocument()
    })

    it('renders a radio input for each option', () => {
      renderPopover()
      expect(screen.getAllByRole('radio')).toHaveLength(4)
    })
  })

  describe('Selection', () => {
    it('marks the current modelValue as checked', () => {
      renderPopover('increment')
      const checked = screen.getAllByRole('radio').find((r) => (r as HTMLInputElement).checked)
      expect(checked).toBeDefined()
      expect((checked as HTMLInputElement).value).toBe('increment')
    })

    it('updates v-model when a different option is selected', async () => {
      const { value } = renderPopover('randomize')
      const user = userEvent.setup()

      const fixedRadio = screen
        .getAllByRole('radio')
        .find((r) => (r as HTMLInputElement).value === 'fixed')
      expect(fixedRadio).toBeDefined()

      await user.click(fixedRadio!)
      expect(value.value).toBe('fixed')
    })
  })
})
