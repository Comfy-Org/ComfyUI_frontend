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

const CONTROL_LABELS = {
  fixed: 'Fixed Value',
  increment: 'Increment Value',
  decrement: 'Decrement Value',
  randomize: 'Randomize Value'
} as const satisfies Record<ControlOptions, string>

const isHTMLInputElement = (el: HTMLElement): el is HTMLInputElement =>
  el instanceof HTMLInputElement

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
          fixed: CONTROL_LABELS.fixed,
          fixedDesc: 'Leaves value unchanged',
          increment: CONTROL_LABELS.increment,
          incrementDesc: 'Adds 1 to value',
          decrement: CONTROL_LABELS.decrement,
          decrementDesc: 'Subtracts 1 from value',
          randomize: CONTROL_LABELS.randomize,
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
  template: '<label v-bind="$attrs"><slot /></label>'
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
      renderPopover()
      expect(mockGet).toHaveBeenCalledWith('Comfy.WidgetControlMode')
      expect(screen.getByText('AFTER')).toBeInTheDocument()
      expect(screen.queryByText('BEFORE')).not.toBeInTheDocument()
    })

    it('shows BEFORE copy when Comfy.WidgetControlMode is "before"', () => {
      mockGet.mockReturnValue('before')
      renderPopover()
      expect(mockGet).toHaveBeenCalledWith('Comfy.WidgetControlMode')
      expect(screen.getByText('BEFORE')).toBeInTheDocument()
      expect(screen.queryByText('AFTER')).not.toBeInTheDocument()
    })
  })

  describe('Option rendering', () => {
    it('renders all four control options', () => {
      renderPopover()
      for (const label of Object.values(CONTROL_LABELS)) {
        expect(screen.getByText(label)).toBeInTheDocument()
      }
    })

    it('renders a radio input for each option', () => {
      renderPopover()
      expect(screen.getAllByRole('radio')).toHaveLength(
        Object.keys(CONTROL_LABELS).length
      )
    })
  })

  describe('Selection', () => {
    it('marks the current modelValue as checked', () => {
      renderPopover('increment')
      const checked = screen
        .getAllByRole('radio')
        .filter(isHTMLInputElement)
        .find((r) => r.checked)
      expect(checked).toBeDefined()
      expect(checked?.value).toBe('increment')
    })

    it('updates v-model when a different option is selected', async () => {
      const { value } = renderPopover('randomize')
      const user = userEvent.setup()

      const fixedRadio = screen
        .getAllByRole('radio')
        .filter(isHTMLInputElement)
        .find((r) => r.value === 'fixed')
      expect(fixedRadio).toBeDefined()

      await user.click(fixedRadio!)
      expect(value.value).toBe('fixed')
    })
  })
})
