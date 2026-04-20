import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import FormDropdownInput from './FormDropdownInput.vue'
import type { FormDropdownItem } from './types'

const items: FormDropdownItem[] = [
  { id: 'a', name: 'alpha' },
  { id: 'b', name: 'beta', label: 'Beta Label' },
  { id: 'c', name: 'gamma' }
]

function renderInput(
  props: Partial<{
    isOpen: boolean
    placeholder: string
    items: FormDropdownItem[]
    selected: Set<string>
    maxSelectable: number
    uploadable: boolean
    disabled: boolean
    accept: string
  }> = {},
  listeners: Record<string, (...args: unknown[]) => void> = {}
) {
  return render(FormDropdownInput, {
    props: {
      items,
      selected: new Set(),
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
      renderInput({
        selected: new Set(['a']),
        ...({ displayItems } as { displayItems: FormDropdownItem[] })
      })
      expect(screen.getByText('ALPHA_DISPLAY')).toBeInTheDocument()
    })
  })

  describe('Select button', () => {
    it('emits select-click when the button is clicked', async () => {
      const onSelectClick = vi.fn()
      renderInput({}, { onSelectClick })
      const user = userEvent.setup()
      await user.click(
        screen.getByRole('button', { name: /select|alpha|beta|gamma/i })
      )
      expect(onSelectClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Upload affordance', () => {
    it('does not render file input when uploadable is false', () => {
      const { container } = renderInput({ uploadable: false })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('input[type="file"]')).toBeNull()
    })

    it('renders a file input when uploadable is true', () => {
      const { container } = renderInput({ uploadable: true })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).toBeInTheDocument()
    })

    it('passes accept attribute to the file input', () => {
      const { container } = renderInput({
        uploadable: true,
        accept: 'image/png'
      })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).toHaveAttribute('accept', 'image/png')
    })

    it('marks file input multiple when maxSelectable > 1', () => {
      const { container } = renderInput({ uploadable: true, maxSelectable: 4 })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).toHaveAttribute('multiple')
    })

    it('does not mark file input multiple when maxSelectable is 1', () => {
      const { container } = renderInput({ uploadable: true, maxSelectable: 1 })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).not.toHaveAttribute('multiple')
    })

    it('disables file input when disabled prop is true', () => {
      const { container } = renderInput({ uploadable: true, disabled: true })
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).toBeDisabled()
    })

    it('emits file-change when a file is uploaded', async () => {
      const onFileChange = vi.fn()
      const { container } = renderInput(
        { uploadable: true },
        { onFileChange }
      )
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      const user = userEvent.setup()
      await user.upload(
        fileInput,
        new File(['hi'], 'hi.txt', { type: 'text/plain' })
      )
      expect(onFileChange).toHaveBeenCalledTimes(1)
    })
  })
})
