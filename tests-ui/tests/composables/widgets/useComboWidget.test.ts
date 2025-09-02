import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComboWidget } from '@/composables/widgets/useComboWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { fileNameMappingService } from '@/services/fileNameMappingService'

// Mock api to prevent app initialization
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    addEventListener: vi.fn(),
    apiURL: vi.fn((path) => `/api${path}`),
    fileURL: vi.fn((path) => path)
  }
}))

vi.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: vi.fn()
}))

vi.mock('@/services/fileNameMappingService', () => ({
  fileNameMappingService: {
    getMapping: vi.fn().mockResolvedValue({}),
    getCachedMapping: vi.fn().mockReturnValue({}),
    getCachedReverseMapping: vi.fn().mockReturnValue({}),
    refreshMapping: vi.fn().mockResolvedValue({}),
    invalidateCache: vi.fn()
  }
}))

describe('useComboWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle undefined spec', () => {
    const constructor = useComboWidget()
    const mockNode = {
      addWidget: vi.fn().mockReturnValue({ options: {} } as any)
    }

    const inputSpec: InputSpec = {
      type: 'COMBO',
      name: 'inputName'
    }

    const widget = constructor(mockNode as any, inputSpec)

    expect(mockNode.addWidget).toHaveBeenCalledWith(
      'combo',
      'inputName',
      undefined, // default value
      expect.any(Function), // callback
      expect.objectContaining({
        values: []
      })
    )
    expect(widget).toEqual({ options: {} })
  })

  describe('filename mapping', () => {
    it('should apply filename mapping to widgets with file extensions', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'image',
        value: 'abc123.png',
        options: {
          values: ['abc123.png', 'def456.jpg']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'image',
        options: ['abc123.png', 'def456.jpg', 'xyz789.webp']
      }

      // Setup mapping service mocks
      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'vacation_photo.png',
        'def456.jpg': 'profile_picture.jpg',
        'xyz789.webp': 'animated_logo.webp'
      })

      vi.mocked(fileNameMappingService.getCachedReverseMapping).mockReturnValue(
        {
          'vacation_photo.png': 'abc123.png',
          'profile_picture.jpg': 'def456.jpg',
          'animated_logo.webp': 'xyz789.webp'
        }
      )

      vi.mocked(fileNameMappingService.getMapping).mockResolvedValue({
        'abc123.png': 'vacation_photo.png',
        'def456.jpg': 'profile_picture.jpg',
        'xyz789.webp': 'animated_logo.webp'
      })

      const widget = constructor(mockNode as any, inputSpec)

      // Widget should have mapping methods
      expect(widget).toBeDefined()
      expect(typeof (widget as any).refreshMappings).toBe('function')
      expect(typeof (widget as any).serializeValue).toBe('function')
    })

    it('should display human-readable names in dropdown', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'image',
        value: 'abc123.png',
        options: {
          values: ['abc123.png', 'def456.jpg']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'image',
        options: ['abc123.png', 'def456.jpg']
      }

      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'vacation_photo.png',
        'def456.jpg': 'profile_picture.jpg'
      })

      const widget = constructor(mockNode as any, inputSpec) as any

      // Access options.values through the proxy
      const dropdownValues = widget.options.values

      // Should return human-readable names
      expect(dropdownValues).toEqual([
        'vacation_photo.png',
        'profile_picture.jpg'
      ])
    })

    it('should handle selection of human-readable name and convert to hash', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'image',
        value: 'abc123.png',
        options: {
          values: ['abc123.png']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'image',
        options: ['abc123.png']
      }

      vi.mocked(fileNameMappingService.getCachedReverseMapping).mockReturnValue(
        {
          'vacation_photo.png': 'abc123.png'
        }
      )

      const widget = constructor(mockNode as any, inputSpec) as any

      // Simulate selecting human-readable name
      widget.callback('vacation_photo.png')

      // Should store hash value
      expect(widget.value).toBe('abc123.png')
    })

    it('should not apply mapping to non-file widgets', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'mode',
        value: 'linear',
        options: {
          values: ['linear', 'cubic', 'nearest']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget)
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'mode',
        options: ['linear', 'cubic', 'nearest']
      }

      const widget = constructor(mockNode as any, inputSpec)

      // Should not have mapping methods
      expect((widget as any).refreshMappings).toBeUndefined()
      expect((widget as any).serializeValue).toBeUndefined()
    })

    it('should show newly uploaded file in dropdown even without mapping', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'image',
        value: 'abc123.png',
        options: {
          values: ['abc123.png']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'image',
        options: ['abc123.png']
      }

      // Start with mapping for existing file only
      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'vacation_photo.png'
      })

      const widget = constructor(mockNode as any, inputSpec) as any

      // Simulate adding new file without mapping yet
      const newValues = [...mockWidget.options.values, 'new789.png']
      mockWidget.options.values = newValues

      // Mapping still doesn't have the new file
      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'vacation_photo.png'
      })

      // Force refresh
      widget.refreshMappings()

      // Access updated dropdown values
      const dropdownValues = widget.options.values

      // Should show human name for mapped file and hash for unmapped file
      expect(dropdownValues).toEqual(['vacation_photo.png', 'new789.png'])
    })

    it('should handle dropdown update after new file upload', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'image',
        value: 'abc123.png',
        options: {
          values: ['abc123.png']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'image',
        options: ['abc123.png']
      }

      // Initial mapping
      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'vacation_photo.png'
      })

      const widget = constructor(mockNode as any, inputSpec) as any

      // The proxy should initially return mapped values
      expect(widget.options.values).toEqual(['vacation_photo.png'])

      // Simulate adding new file by replacing the values array (as happens in practice)
      // This is how addToComboValues would modify it
      const newValues = [...mockWidget.options.values, 'new789.png']
      mockWidget.options.values = newValues

      // Update mapping to include the new file
      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'vacation_photo.png',
        'new789.png': 'new_upload.png'
      })

      // Force refresh of cached values
      widget.refreshMappings()

      // Access updated dropdown values - proxy should recompute with new mapping
      const dropdownValues = widget.options.values

      // Should include both mapped names
      expect(dropdownValues).toEqual(['vacation_photo.png', 'new_upload.png'])
    })

    it('should display hash as fallback when no mapping exists', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'image',
        value: 'unmapped123.png',
        options: {
          values: ['unmapped123.png']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'image',
        options: ['unmapped123.png']
      }

      // Return empty mapping
      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({})

      const widget = constructor(mockNode as any, inputSpec) as any

      // Access _displayValue
      const displayValue = widget._displayValue

      // Should show hash when no mapping exists
      expect(displayValue).toBe('unmapped123.png')

      // Dropdown should also show hash
      const dropdownValues = widget.options.values
      expect(dropdownValues).toEqual(['unmapped123.png'])
    })

    it('should serialize widget value as hash for API calls', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'image',
        value: 'abc123.png',
        options: {
          values: ['abc123.png']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'image',
        options: ['abc123.png']
      }

      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'vacation_photo.png'
      })

      const widget = constructor(mockNode as any, inputSpec) as any

      // serializeValue should always return hash
      const serialized = widget.serializeValue()
      expect(serialized).toBe('abc123.png')
    })

    it('should ensure widget.value always contains hash for API calls', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'image',
        value: 'abc123.png',
        options: {
          values: ['abc123.png']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'image',
        options: ['abc123.png']
      }

      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'vacation.png'
      })

      vi.mocked(fileNameMappingService.getCachedReverseMapping).mockReturnValue(
        {
          'vacation.png': 'abc123.png'
        }
      )

      const widget = constructor(mockNode as any, inputSpec) as any

      // Simulate user selecting from dropdown (human name)
      widget.setValue('vacation.png')

      // Widget.value should contain the hash for API calls
      expect(widget.value).toBe('abc123.png')

      // Callback should also convert human name to hash
      widget.callback('vacation.png')
      expect(widget.value).toBe('abc123.png')

      // The value used for API calls should always be the hash
      // This is what would be used in /view?filename=...
      const apiValue = widget.value
      expect(apiValue).toBe('abc123.png')
    })

    it('should handle arrow key navigation with filename mapping', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'image',
        value: 'abc123.png',
        options: {
          values: ['abc123.png', 'def456.jpg', 'xyz789.webp']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'image',
        options: ['abc123.png', 'def456.jpg', 'xyz789.webp']
      }

      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'vacation.png',
        'def456.jpg': 'profile.jpg',
        'xyz789.webp': 'banner.webp'
      })

      vi.mocked(fileNameMappingService.getCachedReverseMapping).mockReturnValue(
        {
          'vacation.png': 'abc123.png',
          'profile.jpg': 'def456.jpg',
          'banner.webp': 'xyz789.webp'
        }
      )

      const widget = constructor(mockNode as any, inputSpec) as any

      // Test increment (arrow right/up)
      widget.incrementValue({ canvas: { last_mouseclick: 0 } })

      // Should move from abc123.png to def456.jpg
      expect(widget.value).toBe('def456.jpg')

      // Test decrement (arrow left/down)
      widget.decrementValue({ canvas: { last_mouseclick: 0 } })

      // Should move back to abc123.png
      expect(widget.value).toBe('abc123.png')
    })

    it('should handle mixed file and non-file options', () => {
      const constructor = useComboWidget()
      const mockWidget = {
        name: 'source',
        value: 'abc123.png',
        options: {
          values: ['abc123.png', 'none', 'default']
        },
        callback: vi.fn()
      }

      const mockNode = {
        addWidget: vi.fn().mockReturnValue(mockWidget),
        setDirtyCanvas: vi.fn(),
        graph: {
          setDirtyCanvas: vi.fn()
        }
      }

      const inputSpec: InputSpec = {
        type: 'COMBO',
        name: 'source',
        options: ['abc123.png', 'none', 'default']
      }

      vi.mocked(fileNameMappingService.getCachedMapping).mockReturnValue({
        'abc123.png': 'background.png'
      })

      const widget = constructor(mockNode as any, inputSpec) as any

      const dropdownValues = widget.options.values

      // Should map file, but leave non-files unchanged
      expect(dropdownValues).toEqual(['background.png', 'none', 'default'])
    })
  })
})
