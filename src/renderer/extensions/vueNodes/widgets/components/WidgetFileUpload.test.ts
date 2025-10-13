import { mount } from '@vue/test-utils'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import { createMockFile, createMockWidget } from '../testUtils'
import WidgetFileUpload from './WidgetFileUpload.vue'

describe('WidgetFileUpload File Handling', () => {
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

  const mockObjectURL = 'blob:mock-url'

  beforeEach(() => {
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => mockObjectURL)
    global.URL.revokeObjectURL = vi.fn()
  })

  describe('Initial States', () => {
    it('shows upload UI when no file is selected', () => {
      const widget = createMockWidget<File[] | null>(null, {}, undefined, {
        name: 'test_file_upload',
        type: 'file'
      })
      const wrapper = mountComponent(widget, null)

      expect(wrapper.text()).toContain('Drop your file or')
      expect(wrapper.text()).toContain('Browse Files')
      expect(wrapper.find('button').text()).toBe('Browse Files')
    })

    it('renders file input with correct attributes', () => {
      const widget = createMockWidget<File[] | null>(
        null,
        { accept: 'image/*' },
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
      const wrapper = mountComponent(widget, null)

      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.exists()).toBe(true)
      expect(fileInput.attributes('accept')).toBe('image/*')
      expect(fileInput.classes()).toContain('hidden')
    })
  })

  describe('File Selection', () => {
    it('triggers file input when browse button is clicked', async () => {
      const widget = createMockWidget<File[] | null>(null, {}, undefined, {
        name: 'test_file_upload',
        type: 'file'
      })
      const wrapper = mountComponent(widget, null)

      const fileInput = wrapper.find('input[type="file"]')
      const inputElement = fileInput.element
      if (!(inputElement instanceof HTMLInputElement)) {
        throw new Error('Expected HTMLInputElement')
      }
      const clickSpy = vi.spyOn(inputElement, 'click')

      const browseButton = wrapper.find('button')
      await browseButton.trigger('click')

      expect(clickSpy).toHaveBeenCalled()
    })

    it('handles file selection', async () => {
      const mockCallback = vi.fn()
      const widget = createMockWidget<File[] | null>(null, {}, mockCallback, {
        name: 'test_file_upload',
        type: 'file'
      })
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
      const widget = createMockWidget<File[] | null>(null, {}, undefined, {
        name: 'test_file_upload',
        type: 'file'
      })
      const wrapper = mountComponent(widget, null)

      const file = createMockFile('test.jpg', 'image/jpeg')
      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        writable: false
      })

      await fileInput.trigger('change')

      const inputElement = fileInput.element
      if (!(inputElement instanceof HTMLInputElement)) {
        throw new Error('Expected HTMLInputElement')
      }
      expect(inputElement.value).toBe('')
    })
  })

  describe('Image File Display', () => {
    it('shows image preview for image files', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget<File[] | null>(
        [imageFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
      const wrapper = mountComponent(widget, [imageFile])

      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe(mockObjectURL)
      expect(img.attributes('alt')).toBe('test.jpg')
    })

    it('shows select dropdown with filename for images', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget<File[] | null>(
        [imageFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
      const wrapper = mountComponent(widget, [imageFile])

      const select = wrapper.getComponent({ name: 'Select' })
      expect(select.props('modelValue')).toBe('test.jpg')
      expect(select.props('options')).toEqual(['test.jpg'])
      expect(select.props('disabled')).toBe(true)
    })

    it('shows edit and delete buttons on hover for images', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget<File[] | null>(
        [imageFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
      const wrapper = mountComponent(widget, [imageFile])

      // The pi-pencil and pi-times classes are on the <i> elements inside the buttons
      const editIcon = wrapper.find('i.pi-pencil')
      const deleteIcon = wrapper.find('i.pi-times')

      expect(editIcon.exists()).toBe(true)
      expect(deleteIcon.exists()).toBe(true)
    })
  })

  describe('Audio File Display', () => {
    it('shows audio player for audio files', () => {
      const audioFile = createMockFile('test.mp3', 'audio/mpeg')
      const widget = createMockWidget<File[] | null>(
        [audioFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
      const wrapper = mountComponent(widget, [audioFile])

      expect(wrapper.find('.pi-volume-up').exists()).toBe(true)
      expect(wrapper.text()).toContain('test.mp3')
      expect(wrapper.text()).toContain('1.0 KB')
    })

    it('shows file size for audio files', () => {
      const audioFile = createMockFile('test.mp3', 'audio/mpeg', 2048)
      const widget = createMockWidget<File[] | null>(
        [audioFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
      const wrapper = mountComponent(widget, [audioFile])

      expect(wrapper.text()).toContain('2.0 KB')
    })

    it('shows delete button for audio files', () => {
      const audioFile = createMockFile('test.mp3', 'audio/mpeg')
      const widget = createMockWidget<File[] | null>(
        [audioFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
      const wrapper = mountComponent(widget, [audioFile])

      const deleteIcon = wrapper.find('i.pi-times')
      expect(deleteIcon.exists()).toBe(true)
    })
  })

  describe('File Type Detection', () => {
    const imageFiles = [
      { name: 'image.jpg', type: 'image/jpeg' },
      { name: 'image.png', type: 'image/png' }
    ]

    const audioFiles = [
      { name: 'audio.mp3', type: 'audio/mpeg' },
      { name: 'audio.wav', type: 'audio/wav' }
    ]

    const normalFiles = [
      { name: 'video.mp4', type: 'video/mp4' },
      { name: 'document.pdf', type: 'application/pdf' }
    ]

    it.for(imageFiles)(
      'shows image preview for $type files',
      ({ name, type }) => {
        const file = createMockFile(name, type)
        const widget = createMockWidget<File[] | null>([file], {}, undefined, {
          name: 'test_file_upload',
          type: 'file'
        })
        const wrapper = mountComponent(widget, [file])

        expect(wrapper.find('img').exists()).toBe(true)
        expect(wrapper.find('.pi-volume-up').exists()).toBe(false)
      }
    )

    it.for(audioFiles)(
      'shows audio player for $type files',
      ({ name, type }) => {
        const file = createMockFile(name, type)
        const widget = createMockWidget<File[] | null>([file], {}, undefined, {
          name: 'test_file_upload',
          type: 'file'
        })
        const wrapper = mountComponent(widget, [file])

        expect(wrapper.find('.pi-volume-up').exists()).toBe(true)
        expect(wrapper.find('img').exists()).toBe(false)
      }
    )

    it.for(normalFiles)('shows normal UI for $type files', ({ name, type }) => {
      const file = createMockFile(name, type)
      const widget = createMockWidget<File[] | null>([file], {}, undefined, {
        name: 'test_file_upload',
        type: 'file'
      })
      const wrapper = mountComponent(widget, [file])

      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.find('.pi-volume-up').exists()).toBe(false)
    })
  })

  describe('File Actions', () => {
    it('clears file when delete button is clicked', async () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget<File[] | null>(
        [imageFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
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
      const widget = createMockWidget<File[] | null>(
        [imageFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
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
      const widget = createMockWidget<File[] | null>(
        [imageFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
      const wrapper = mountComponent(widget, [imageFile])

      const fileInput = wrapper.find('input[type="file"]')
      const inputElement = fileInput.element
      if (!(inputElement instanceof HTMLInputElement)) {
        throw new Error('Expected HTMLInputElement')
      }
      const clickSpy = vi.spyOn(inputElement, 'click')

      // Find PrimeVue Button component with folder icon
      const folderButton = wrapper.getComponent(Button)

      await folderButton.trigger('click')

      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty file selection gracefully', async () => {
      const widget = createMockWidget<File[] | null>(null, {}, undefined, {
        name: 'test_file_upload',
        type: 'file'
      })
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
      const widget = createMockWidget<File[] | null>(null, {}, undefined, {
        name: 'test_file_upload',
        type: 'file'
      })
      const wrapper = mountComponent(widget, null)

      // Remove file input ref to simulate missing element
      wrapper.vm.$refs.fileInputRef = null

      // Should not throw error when method exists
      const vm = wrapper.vm as any
      expect(() => vm.triggerFileInput?.()).not.toThrow()
    })

    it('handles clearing file when no file input exists', async () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg')
      const widget = createMockWidget<File[] | null>(
        [imageFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
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
      const widget = createMockWidget<File[] | null>(
        [imageFile],
        {},
        undefined,
        {
          name: 'test_file_upload',
          type: 'file'
        }
      )
      const wrapper = mountComponent(widget, [imageFile])

      wrapper.unmount()

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectURL)
    })
  })
})
