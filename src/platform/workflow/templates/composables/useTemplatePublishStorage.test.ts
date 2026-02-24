import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadTemplateUnderway,
  saveTemplateUnderway
} from '@/platform/workflow/templates/composables/useTemplatePublishStorage'
import type { MarketplaceTemplate } from '@/types/templateMarketplace'

const STORAGE_KEY = 'Comfy.TemplateMarketplace.TemplateUnderway'

const storageMocks = vi.hoisted(() => ({
  getStorageValue: vi.fn(),
  setStorageValue: vi.fn()
}))

vi.mock('@/scripts/utils', () => storageMocks)

describe('useTemplatePublishStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const template: Partial<MarketplaceTemplate> = {
    title: 'My Template',
    description: 'A test template',
    difficulty: 'beginner',
    tags: ['test']
  }

  describe('saveTemplateUnderway', () => {
    it('serialises the template and writes it to storage', () => {
      saveTemplateUnderway(template)

      expect(storageMocks.setStorageValue).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(template)
      )
    })

    it('throws TypeError when the template cannot be serialised', () => {
      const circular = { title: 'oops' } as Partial<MarketplaceTemplate>
      ;(circular as Record<string, unknown>).self = circular

      expect(() => saveTemplateUnderway(circular)).toThrow(TypeError)
      expect(storageMocks.setStorageValue).not.toHaveBeenCalled()
    })
  })

  describe('loadTemplateUnderway', () => {
    it('returns the parsed template when storage contains valid JSON', () => {
      storageMocks.getStorageValue.mockReturnValue(JSON.stringify(template))

      expect(loadTemplateUnderway()).toEqual(template)
      expect(storageMocks.getStorageValue).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it('returns null when no value is stored', () => {
      storageMocks.getStorageValue.mockReturnValue(null)

      expect(loadTemplateUnderway()).toBeNull()
    })

    it('returns null when stored value is invalid JSON', () => {
      storageMocks.getStorageValue.mockReturnValue('not json{{{')

      expect(loadTemplateUnderway()).toBeNull()
    })
  })

  describe('round-trip', () => {
    beforeEach(() => {
      let stored: string | null = null
      storageMocks.setStorageValue.mockImplementation(
        (_key: string, value: string) => {
          stored = value
        }
      )
      storageMocks.getStorageValue.mockImplementation(() => stored)
    })

    it.each<{
      label: string
      input: Partial<MarketplaceTemplate>
    }>([
      {
        label: 'string values',
        input: { title: 'hello', description: '' }
      },
      {
        label: 'number values',
        input: { vramRequirement: 0 }
      },
      {
        label: 'negative and fractional numbers',
        input: { vramRequirement: -1.5 }
      },
      {
        label: 'boolean values',
        input: {
          author: { id: '1', name: 'a', isVerified: false, profileUrl: '' }
        }
      },
      {
        label: 'null values',
        input: { videoPreview: undefined, reviewFeedback: undefined }
      },
      {
        label: 'array values',
        input: { tags: ['a', 'b'], categories: [], requiredNodes: ['node1'] }
      },
      {
        label: 'nested objects',
        input: {
          author: {
            id: '1',
            name: 'Author',
            isVerified: true,
            profileUrl: '/u/1'
          },
          stats: {
            downloads: 42,
            favorites: 7,
            rating: 4.5,
            reviewCount: 3,
            weeklyTrend: -2.1
          }
        }
      },
      {
        label: 'mixed types in a single template',
        input: {
          id: '123',
          title: 'Full',
          description: 'A template with all JSON types',
          tags: ['mixed'],
          vramRequirement: 8_000_000_000,
          author: { id: '1', name: 'Test', isVerified: true, profileUrl: '' },
          gallery: [
            {
              type: 'image',
              url: 'https://example.com/img.png',
              isBefore: true
            }
          ],
          requiredModels: [{ name: 'model', type: 'checkpoint', size: 0 }],
          stats: {
            downloads: 0,
            favorites: 0,
            rating: 0,
            reviewCount: 0,
            weeklyTrend: 0
          }
        }
      }
    ])('preserves $label through save/load', ({ input }) => {
      saveTemplateUnderway(input)
      const result = loadTemplateUnderway()

      expect(result).toEqual(structuredClone(input))
    })
  })
})
