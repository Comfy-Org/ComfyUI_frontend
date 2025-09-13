import { mount } from '@vue/test-utils'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetFileUpload from './WidgetFileUpload.vue'

describe('WidgetFileUpload File Handling', () => {
  const createMockWidget = (
    value: File[] | null = null,
    options: Record<string, any> = {},
    callback?: (value: File[] | null) => void
  ): SimplifiedWidget<File[] | null> => ({
    name: 'test_file_upload',
    type: 'file',
    value,
    options,
    callback
  })

  const mountComponent = (
    widget: SimplifiedWidget<File[] | null>,
    modelValue: File[] | null,
    readonly = false
  ) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          ...enMessages,
          'Drop your file or': 'Drop your file or'
        }
      }
    })

    return mount(WidgetFileUpload, {
      global: {
        plugins: [PrimeVue, i18n],
        components: { Button, Select }
      },
      props: {
        widget,
        modelValue,
        readonly
      }
    })
  }

  const createMockFile = (name: string, type: string, size = 1024): File => {
    const file = new File(['mock content'], name, { type })
    Object.defineProperty(file, 'size', {
      value: size,
      writable: false
    })
    return file
  }

  const mockObjectURL = 'blob:mock-url'

  beforeEach(() => {
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => mockObjectURL)
    global.URL.revokeObjectURL = vi.fn()
  })

  describe('Initial States', () => {
    it('shows upload UI when no file is selected', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, null)

      expect(wrapper.text()).toContain('Drop your file or')
      expect(wrapper.text()).toContain('Browse Files')
      expect(wrapper.find('button').text()).toBe('Browse Files')
    })

    it('renders file input with correct attributes', () => {
      const widget = createMockWidget(null, { accept: 'image/*' })
      const wrapper = mountComponent(widget, null)

      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.exists()).toBe(true)
      expect(fileInput.attributes('accept')).toBe('image/*')
      expect(fileInput.classes()).toContain('hidden')
    })
  })

  describe('File Selection', () => {
    it('triggers file input when browse button is clicked', async () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, null)

      const fileInput = wrapper.find('input[type="file"]')
      const clickSpy = vi.spyOn(fileInput.element as HTMLInputElement, 'click')

      const browseButton = wrapper.find('button')
      await browseButton.trigger('click')

      expect(clickSpy).toHaveBeenCalled()
    })

    it('handles file selection', async () => {
      const mockCallback = vi.fn()
      const widget = createMockWidget(null, {}, mockCallback)
      const wrapper = mountComponent(widget, null)

      const file = createMockFile('test.jpg', 'image/jpeg')
      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        writable: false
      })

      await fileInput.trigger('change')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([[file]])
    })

    it('resets file input after selection', async () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, null)

      const file = createMockFile('test.jpg', 'image/jpeg')
      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        writable: false
      })

      await fileInput.trigger('change')

      expect((fileInput.element as HTMLInputElement).value).toBe('')
    })
  })

  describe('Image File Display', () => {
    it('shows image preview for image files', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile])

      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe(mockObjectURL)
      expect(img.attributes('alt')).toBe('test.jpg')
    })

    it('shows select dropdown with filename for images', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile])

      const select = wrapper.findComponent({ name: 'Select' })
      expect(select.props('modelValue')).toBe('test.jpg')
      expect(select.props('options')).toEqual(['test.jpg'])
      expect(select.props('disabled')).toBe(true)
    })

    it('shows edit and delete buttons on hover for images', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile])

      // The pi-pencil and pi-times classes are on the <i> elements inside the buttons
      const editIcon = wrapper.find('i.pi-pencil')
      const deleteIcon = wrapper.find('i.pi-times')

      expect(editIcon.exists()).toBe(true)
      expect(deleteIcon.exists()).toBe(true)
    })

    it('hides control buttons in readonly mode', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile], true)

      const controlButtons = wrapper.find('.absolute.top-2.right-2')
      expect(controlButtons.exists()).toBe(false)
    })
  })

  describe('Audio File Display', () => {
    it('shows audio player for audio files', () => {
      const audioFile = createMockFile('test.mp3', 'audio/mpeg')
      const widget = createMockWidget([audioFile])
      const wrapper = mountComponent(widget, [audioFile])

      expect(wrapper.find('.pi-volume-up').exists()).toBe(true)
      expect(wrapper.text()).toContain('test.mp3')
      expect(wrapper.text()).toContain('1.0 KB')
    })

    it('shows file size for audio files', () => {
      const audioFile = createMockFile('test.mp3', 'audio/mpeg', 2048)
      const widget = createMockWidget([audioFile])
      const wrapper = mountComponent(widget, [audioFile])

      expect(wrapper.text()).toContain('2.0 KB')
    })

    it('shows delete button for audio files', () => {
      const audioFile = createMockFile('test.mp3', 'audio/mpeg')
      const widget = createMockWidget([audioFile])
      const wrapper = mountComponent(widget, [audioFile])

      const deleteIcon = wrapper.find('i.pi-times')
      expect(deleteIcon.exists()).toBe(true)
    })
  })

  describe('File Type Detection', () => {
    const testCases = [
      { name: 'image.jpg', type: 'image/jpeg', expected: 'image' },
      { name: 'image.png', type: 'image/png', expected: 'image' },
      { name: 'audio.mp3', type: 'audio/mpeg', expected: 'audio' },
      { name: 'audio.wav', type: 'audio/wav', expected: 'audio' },
      { name: 'video.mp4', type: 'video/mp4', expected: 'normal' }, // falls back to normal UI
      { name: 'document.pdf', type: 'application/pdf', expected: 'normal' }
    ]

    testCases.forEach(({ name, type, expected }) => {
      it(`correctly handles ${type} files`, () => {
        const file = createMockFile(name, type)
        const widget = createMockWidget([file])
        const wrapper = mountComponent(widget, [file])

        if (expected === 'image') {
          expect(wrapper.find('img').exists()).toBe(true)
        } else if (expected === 'audio') {
          expect(wrapper.find('.pi-volume-up').exists()).toBe(true)
        } else {
          // Should show normal upload UI when no specific preview is available
          expect(wrapper.find('img').exists()).toBe(false)
          expect(wrapper.find('.pi-volume-up').exists()).toBe(false)
        }
      })
    })
  })

  describe('File Actions', () => {
    it('clears file when delete button is clicked', async () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile])

      // Find button that contains the times icon
      const buttons = wrapper.findAll('button')
      const deleteButton = buttons.find((button) =>
        button.find('i.pi-times').exists()
      )

      if (!deleteButton) {
        throw new Error('Delete button with times icon not found')
      }

      await deleteButton.trigger('click')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![emitted!.length - 1]).toEqual([null])
    })

    it('handles edit button click', async () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile])

      // Find button that contains the pencil icon
      const buttons = wrapper.findAll('button')
      const editButton = buttons.find((button) =>
        button.find('i.pi-pencil').exists()
      )

      if (!editButton) {
        throw new Error('Edit button with pencil icon not found')
      }

      // Should not throw error when clicked (TODO: implement edit functionality)
      await expect(editButton.trigger('click')).resolves.not.toThrow()
    })

    it('triggers file input when folder button is clicked', async () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile])

      const fileInput = wrapper.find('input[type="file"]')
      const clickSpy = vi.spyOn(fileInput.element as HTMLInputElement, 'click')

      // Find PrimeVue Button component with folder icon
      const folderButton = wrapper.findComponent(Button)
      if (!folderButton.exists()) {
        throw new Error('Folder button not found')
      }

      await folderButton.trigger('click')

      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('Readonly Mode', () => {
    it('disables browse button in readonly mode', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, null, true)

      const browseButton = wrapper.find('button')
      expect(browseButton.element.disabled).toBe(true)
    })

    it('disables file input in readonly mode', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, null, true)

      const fileInput = wrapper.find('input[type="file"]')
      expect((fileInput.element as HTMLInputElement).disabled).toBe(true)
    })

    it('disables folder button for images in readonly mode', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile], true)

      const buttons = wrapper.findAll('button')
      const folderButton = buttons.find((button) =>
        button.element.innerHTML.includes('pi-folder')
      )

      if (!folderButton) {
        throw new Error('Folder button not found')
      }

      expect(folderButton.element.disabled).toBe(true)
    })

    it('does not handle file changes in readonly mode', async () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, null, true)

      const file = createMockFile('test.jpg', 'image/jpeg')
      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        writable: false
      })

      await fileInput.trigger('change')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty file selection gracefully', async () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, null)

      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [],
        writable: false
      })

      await fileInput.trigger('change')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeUndefined()
    })

    it('handles missing file input gracefully', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, null)

      // Remove file input ref to simulate missing element
      wrapper.vm.$refs.fileInputRef = null

      // Should not throw error when method exists
      const vm = wrapper.vm as any
      if (vm.triggerFileInput) {
        expect(() => vm.triggerFileInput()).not.toThrow()
      }
    })

    it('handles clearing file when no file input exists', async () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile])

      // Remove file input ref to simulate missing element
      wrapper.vm.$refs.fileInputRef = null

      // Find button that contains the times icon
      const buttons = wrapper.findAll('button')
      const deleteButton = buttons.find((button) =>
        button.find('i.pi-times').exists()
      )

      if (!deleteButton) {
        throw new Error('Delete button with times icon not found')
      }

      // Should not throw error
      await expect(deleteButton.trigger('click')).resolves.not.toThrow()
    })

    it('cleans up object URLs on unmount', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget([imageFile])
      const wrapper = mountComponent(widget, [imageFile])

      wrapper.unmount()

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectURL)
    })
  })
})
