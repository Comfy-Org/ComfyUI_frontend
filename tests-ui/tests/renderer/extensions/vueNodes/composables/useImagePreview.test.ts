import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useImagePreview } from '@/renderer/extensions/vueNodes/composables/useImagePreview'

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('@/stores/imagePreviewStore', () => ({
  useNodeOutputStore: vi.fn(() => ({
    removeNodeOutputs: vi.fn().mockReturnValue(true)
  }))
}))

describe('useImagePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
  const mockImageUrls = [
    '/api/view?filename=test1.png&type=output',
    '/api/view?filename=test2.png&type=output',
    '/api/view?filename=test3.png&type=output'
  ]

  // Helper function to create properly typed mock image events
  const createMockImageEvent = (
    naturalWidth: number,
    naturalHeight: number
  ): Event => {
    // Create a mock that satisfies HTMLImageElement type checking
    const mockImg = Object.create(HTMLImageElement.prototype)

    // Define naturalWidth and naturalHeight as properties since they're readonly on HTMLImageElement
    Object.defineProperty(mockImg, 'naturalWidth', {
      value: naturalWidth,
      writable: false,
      configurable: true
    })
    Object.defineProperty(mockImg, 'naturalHeight', {
      value: naturalHeight,
      writable: false,
      configurable: true
    })

    Object.assign(mockImg, {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      removeEventListener: vi.fn()
    })

    return {
      target: mockImg,
      currentTarget: mockImg,
      srcElement: mockImg,
      bubbles: false,
      cancelBubble: false,
      cancelable: false,
      composed: false,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
      returnValue: true,
      timeStamp: 0,
      type: 'load',
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      stopPropagation: vi.fn(),
      composedPath: vi.fn(() => []),
      initEvent: vi.fn(),
      NONE: 0,
      CAPTURING_PHASE: 1,
      AT_TARGET: 2,
      BUBBLING_PHASE: 3
    } satisfies Event
  }

  it('initializes with correct default state', () => {
    const { currentIndex, isHovered, actualDimensions, hasMultipleImages } =
      useImagePreview(mockImageUrls)

    expect(currentIndex.value).toBe(0)
    expect(isHovered.value).toBe(false)
    expect(actualDimensions.value).toBeNull()
    expect(mockImageUrls.length > 0).toBe(true)
    expect(hasMultipleImages.value).toBe(true)
  })

  it('handles single image correctly', () => {
    const singleImageUrl = [mockImageUrls[0]]
    const { hasMultipleImages } = useImagePreview(singleImageUrl)

    expect(mockImageUrls.length > 0).toBe(true)
    expect(hasMultipleImages.value).toBe(false)
  })

  it('handles empty image array correctly', () => {
    const { hasMultipleImages, currentImageUrl } = useImagePreview([])

    expect([].length > 0).toBe(false)
    expect(hasMultipleImages.value).toBe(false)
    expect(currentImageUrl.value).toBeUndefined()
  })

  it('computes currentImageUrl correctly', () => {
    const { currentImageUrl, setCurrentIndex } = useImagePreview(mockImageUrls)

    expect(currentImageUrl.value).toBe(mockImageUrls[0])

    setCurrentIndex(1)
    expect(currentImageUrl.value).toBe(mockImageUrls[1])
  })

  it('handles setCurrentIndex with bounds checking', () => {
    const { currentIndex, setCurrentIndex } = useImagePreview(mockImageUrls)

    // Valid index
    setCurrentIndex(2)
    expect(currentIndex.value).toBe(2)

    // Invalid index (too high)
    setCurrentIndex(5)
    expect(currentIndex.value).toBe(2) // Should remain unchanged

    // Invalid index (negative)
    setCurrentIndex(-1)
    expect(currentIndex.value).toBe(2) // Should remain unchanged
  })

  it('handles download action', () => {
    // Mock DOM methods
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn()
    }
    const mockCreateElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(mockLink as unknown as HTMLAnchorElement)
    const mockAppendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation(() => mockLink as unknown as HTMLAnchorElement)
    const mockRemoveChild = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation(() => mockLink as unknown as HTMLAnchorElement)

    const { handleDownload } = useImagePreview(mockImageUrls)
    handleDownload()

    expect(mockCreateElement).toHaveBeenCalledWith('a')
    expect(mockLink.href).toBe(mockImageUrls[0])
    expect(mockLink.click).toHaveBeenCalled()
    expect(mockAppendChild).toHaveBeenCalledWith(mockLink)
    expect(mockRemoveChild).toHaveBeenCalledWith(mockLink)

    mockCreateElement.mockRestore()
    mockAppendChild.mockRestore()
    mockRemoveChild.mockRestore()
  })

  it('handles image load event correctly', () => {
    const { handleImageLoad, actualDimensions } = useImagePreview(mockImageUrls)

    const mockEvent = createMockImageEvent(1024, 768)
    handleImageLoad(mockEvent)

    expect(actualDimensions.value).toBe('1024 x 768')
  })

  it('handles image load event with invalid dimensions', () => {
    const { handleImageLoad, actualDimensions } = useImagePreview(mockImageUrls)

    const mockEvent = createMockImageEvent(0, 0)
    handleImageLoad(mockEvent)

    expect(actualDimensions.value).toBeNull()
  })

  it('resets dimensions when changing images', () => {
    const { actualDimensions, setCurrentIndex, handleImageLoad } =
      useImagePreview(mockImageUrls)

    // Set dimensions for first image
    const mockEvent = createMockImageEvent(1024, 768)
    handleImageLoad(mockEvent)
    expect(actualDimensions.value).toBe('1024 x 768')

    // Change to second image
    setCurrentIndex(1)
    expect(actualDimensions.value).toBeNull()
  })
})
