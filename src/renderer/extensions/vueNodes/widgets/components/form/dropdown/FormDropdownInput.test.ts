import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import FormDropdownInput from './FormDropdownInput.vue'
import type { FormDropdownInputProps, FormDropdownItem } from './types'

const items: FormDropdownItem[] = [
  { id: 'a', name: 'alpha' },
  { id: 'b', name: 'beta', label: 'Beta Label' },
  { id: 'c', name: 'gamma' }
]

const uploadLabel = 'Upload'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { upload: uploadLabel } } }
})

function renderInput(
  props: Partial<FormDropdownInputProps> = {},
  listeners: Record<string, (...args: unknown[]) => void> = {}
) {
  return render(FormDropdownInput, {
    global: {
      plugins: [i18n]
    },
    props: {
      items,
      selected: new Set<string>(),
      maxSelectable: 1,
      uploadable: false,
      disabled: false,
      ...props
    },
    attrs: listeners
  })
}

describe('FormDropdownInput', () => {
  describe('Display text', () => {
    it('shows placeholder when no items are selected', () => {
      renderInput({ placeholder: 'Pick one' })
      expect(screen.getByText('Pick one')).toBeInTheDocument()
    })

    it('shows default placeholder when none is provided', () => {
      renderInput()
      expect(screen.getByText('Select...')).toBeInTheDocument()
    })

    it('shows a single selected item name', () => {
      renderInput({ selected: new Set(['a']) })
      expect(screen.getByText('alpha')).toBeInTheDocument()
    })

    it('prefers label over name when selected item has a label', () => {
      renderInput({ selected: new Set(['b']) })
      expect(screen.getByText('Beta Label')).toBeInTheDocument()
    })

    it('joins multiple selected item labels with ", "', () => {
      renderInput({ selected: new Set(['a', 'c']), maxSelectable: 2 })
      expect(screen.getByText('alpha, gamma')).toBeInTheDocument()
    })

    it('reads display items from displayItems prop when provided', () => {
      const displayItems: FormDropdownItem[] = [
        { id: 'a', name: 'ALPHA_DISPLAY' }
      ]
      renderInput({ selected: new Set(['a']), displayItems })
      expect(screen.getByText('ALPHA_DISPLAY')).toBeInTheDocument()
    })
  })

  describe('Select button', () => {
    it('emits select-click when the button is clicked', async () => {
      const onSelectClick = vi.fn()
      renderInput({}, { onSelectClick })
      const user = userEvent.setup()
      await user.click(screen.getByRole('button'))
      expect(onSelectClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Upload affordance', () => {
    it('does not render file input when uploadable is false', () => {
      renderInput({ uploadable: false })
      expect(screen.queryByLabelText(uploadLabel)).toBeNull()
    })

    it('renders a file input when uploadable is true', () => {
      renderInput({ uploadable: true })
      expect(screen.getByLabelText(uploadLabel)).toBeInTheDocument()
    })

    it('passes accept attribute to the file input', () => {
      renderInput({ uploadable: true, accept: 'image/png' })
      expect(screen.getByLabelText(uploadLabel)).toHaveAttribute(
        'accept',
        'image/png'
      )
    })

    it('marks file input multiple when maxSelectable > 1', () => {
      renderInput({ uploadable: true, maxSelectable: 4 })
      expect(screen.getByLabelText(uploadLabel)).toHaveAttribute('multiple')
    })

    it('does not mark file input multiple when maxSelectable is 1', () => {
      renderInput({ uploadable: true, maxSelectable: 1 })
      expect(screen.getByLabelText(uploadLabel)).not.toHaveAttribute('multiple')
    })

    it('disables file input when disabled prop is true', () => {
      renderInput({ uploadable: true, disabled: true })
      expect(screen.getByLabelText(uploadLabel)).toBeDisabled()
    })

    it('emits file-change when a file is uploaded', async () => {
      const onFileChange = vi.fn()
      renderInput({ uploadable: true }, { onFileChange })
      const fileInput = screen.getByLabelText(uploadLabel) as HTMLInputElement
      const user = userEvent.setup()
      await user.upload(
        fileInput,
        new File(['hi'], 'hi.txt', { type: 'text/plain' })
      )
      expect(onFileChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('Exposed showPicker', () => {
    const overriddenMethods = ['showPicker', 'click'] as const
    const originalDescriptors = overriddenMethods.map(
      (name) =>
        [
          name,
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, name)
        ] as const
    )

    afterEach(() => {
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) {
          Object.defineProperty(HTMLInputElement.prototype, name, descriptor)
        } else {
          Reflect.deleteProperty(HTMLInputElement.prototype, name)
        }
      }
    })

    /** Mount a harness that captures the FormDropdownInput instance so we can
     *  invoke its exposed methods, mirroring how FormDropdown drives it. */
    async function mountWithRef(props: Partial<FormDropdownInputProps> = {}) {
      const inputRef = ref<InstanceType<typeof FormDropdownInput> | null>(null)
      const Harness = defineComponent({
        components: { FormDropdownInput },
        setup: () => ({
          inputRef,
          bindings: {
            items,
            selected: new Set<string>(),
            maxSelectable: 1,
            uploadable: true,
            disabled: false,
            ...props
          }
        }),
        template: '<FormDropdownInput ref="inputRef" v-bind="bindings" />'
      })
      render(Harness, { global: { plugins: [i18n] } })
      await nextTick()
      return inputRef
    }

    it('calls showPicker on the file input when available', async () => {
      const showPickerSpy = vi.fn()
      Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
        value: showPickerSpy,
        configurable: true,
        writable: true
      })
      const inputRef = await mountWithRef()
      inputRef.value!.showPicker()
      expect(showPickerSpy).toHaveBeenCalledTimes(1)
    })

    it('falls back to click() when showPicker is unavailable', async () => {
      // Simulate older browsers that predate showPicker
      Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
        value: undefined,
        configurable: true,
        writable: true
      })
      const clickSpy = vi.fn()
      Object.defineProperty(HTMLInputElement.prototype, 'click', {
        value: clickSpy,
        configurable: true,
        writable: true
      })
      const inputRef = await mountWithRef()
      inputRef.value!.showPicker()
      expect(clickSpy).toHaveBeenCalledTimes(1)
    })
  })
})
