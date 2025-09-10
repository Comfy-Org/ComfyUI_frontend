import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ImagePreview from '@/renderer/extensions/vueNodes/components/ImagePreview.vue'

describe('ImagePreview', () => {
  const defaultProps = {
    imageUrls: [
      '/api/view?filename=test1.png&type=output',
      '/api/view?filename=test2.png&type=output'
    ]
  }

  const mountImagePreview = (props = {}) => {
    return mount(ImagePreview, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          })
        ]
      }
    })
  }

  it('renders image preview when imageUrls provided', () => {
    const wrapper = mountImagePreview()

    expect(wrapper.find('.image-preview').exists()).toBe(true)
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('img').attributes('src')).toBe(
      defaultProps.imageUrls[0]
    )
  })

  it('does not render when no imageUrls provided', () => {
    const wrapper = mountImagePreview({ imageUrls: [] })

    expect(wrapper.find('.image-preview').exists()).toBe(false)
  })

  it('displays dimensions correctly', () => {
    const wrapper = mountImagePreview({ dimensions: '1024 x 768' })

    expect(wrapper.text()).toContain('1024 x 768')
  })

  it('shows navigation dots for multiple images', () => {
    const wrapper = mountImagePreview()

    const navigationDots = wrapper.findAll('.w-2.h-2.rounded-full')
    expect(navigationDots).toHaveLength(2)
  })

  it('does not show navigation dots for single image', () => {
    const wrapper = mountImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    const navigationDots = wrapper.findAll('.w-2.h-2.rounded-full')
    expect(navigationDots).toHaveLength(0)
  })

  it('shows action buttons on hover', async () => {
    const wrapper = mountImagePreview()

    // Initially buttons should not be visible
    expect(wrapper.find('.actions').exists()).toBe(false)

    // Trigger hover
    await wrapper.trigger('mouseenter')
    await nextTick()

    // Action buttons should now be visible
    expect(wrapper.find('.actions').exists()).toBe(true)
    expect(wrapper.findAll('.action-btn')).toHaveLength(3) // mask, download, remove
  })

  it('hides action buttons when not hovering', async () => {
    const wrapper = mountImagePreview()

    // Trigger hover
    await wrapper.trigger('mouseenter')
    await nextTick()
    expect(wrapper.find('.actions').exists()).toBe(true)

    // Trigger mouse leave
    await wrapper.trigger('mouseleave')
    await nextTick()
    expect(wrapper.find('.actions').exists()).toBe(false)
  })

  it('shows mask/edit button only for single images', async () => {
    // Multiple images - should not show mask button
    const multipleImagesWrapper = mountImagePreview()
    await multipleImagesWrapper.trigger('mouseenter')
    await nextTick()

    const maskButtonMultiple = multipleImagesWrapper.find('[title="Edit/Mask"]')
    expect(maskButtonMultiple.exists()).toBe(false)

    // Single image - should show mask button
    const singleImageWrapper = mountImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })
    await singleImageWrapper.trigger('mouseenter')
    await nextTick()

    const maskButtonSingle = singleImageWrapper.find('[title="Edit/Mask"]')
    expect(maskButtonSingle.exists()).toBe(true)
  })

  it('handles action button clicks', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const wrapper = mountImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    await wrapper.trigger('mouseenter')
    await nextTick()

    // Test Edit/Mask button
    await wrapper.find('[title="Edit/Mask"]').trigger('click')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Edit/Mask clicked for:',
      defaultProps.imageUrls[0]
    )

    // Test Remove button
    await wrapper.find('[title="Remove"]').trigger('click')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Remove clicked for:',
      defaultProps.imageUrls[0]
    )

    consoleSpy.mockRestore()
  })

  it('handles download button click', async () => {
    // Mock DOM methods for download test
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn()
    }
    const mockCreateElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(mockLink as any)
    const mockAppendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation(() => mockLink as any)
    const mockRemoveChild = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation(() => mockLink as any)

    const wrapper = mountImagePreview({
      imageUrls: [defaultProps.imageUrls[0]]
    })

    await wrapper.trigger('mouseenter')
    await nextTick()

    // Test Download button
    await wrapper.find('[title="Download"]').trigger('click')

    expect(mockCreateElement).toHaveBeenCalledWith('a')
    expect(mockLink.href).toBe(defaultProps.imageUrls[0])
    expect(mockLink.click).toHaveBeenCalled()

    mockCreateElement.mockRestore()
    mockAppendChild.mockRestore()
    mockRemoveChild.mockRestore()
  })

  it('switches images when navigation dots are clicked', async () => {
    const wrapper = mountImagePreview()

    // Initially shows first image
    expect(wrapper.find('img').attributes('src')).toBe(
      defaultProps.imageUrls[0]
    )

    // Click second navigation dot
    const navigationDots = wrapper.findAll('.w-2.h-2.rounded-full')
    await navigationDots[1].trigger('click')
    await nextTick()

    // Should now show second image
    expect(wrapper.find('img').attributes('src')).toBe(
      defaultProps.imageUrls[1]
    )
  })

  it('applies correct classes to navigation dots based on current image', async () => {
    const wrapper = mountImagePreview()

    const navigationDots = wrapper.findAll('.w-2.h-2.rounded-full')

    // First dot should be active (has bg-white class)
    expect(navigationDots[0].classes()).toContain('bg-white')
    expect(navigationDots[1].classes()).toContain('bg-white/50')

    // Switch to second image
    await navigationDots[1].trigger('click')
    await nextTick()

    // Second dot should now be active
    expect(navigationDots[0].classes()).toContain('bg-white/50')
    expect(navigationDots[1].classes()).toContain('bg-white')
  })

  it('updates dimensions when image loads', async () => {
    const wrapper = mountImagePreview({ dimensions: undefined })

    // Initially shows "Loading..."
    expect(wrapper.text()).toContain('Loading...')

    // Simulate image load event
    const img = wrapper.find('img')
    const mockLoadEvent = {
      target: {
        naturalWidth: 1024,
        naturalHeight: 768
      }
    }
    await img.trigger('load', mockLoadEvent)
    await nextTick()

    // Should now show actual dimensions
    expect(wrapper.text()).toContain('1024 x 768')
  })

  it('handles image load errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountImagePreview()

    const img = wrapper.find('img')
    await img.trigger('error')

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load image:',
      defaultProps.imageUrls[0]
    )

    consoleSpy.mockRestore()
  })

  it('has proper accessibility attributes', () => {
    const wrapper = mountImagePreview()

    const img = wrapper.find('img')
    expect(img.attributes('alt')).toBe('Node output 1')
  })

  it('updates alt text when switching images', async () => {
    const wrapper = mountImagePreview()

    // Initially first image
    expect(wrapper.find('img').attributes('alt')).toBe('Node output 1')

    // Switch to second image
    const navigationDots = wrapper.findAll('.w-2.h-2.rounded-full')
    await navigationDots[1].trigger('click')
    await nextTick()

    // Alt text should update
    expect(wrapper.find('img').attributes('alt')).toBe('Node output 2')
  })
})
