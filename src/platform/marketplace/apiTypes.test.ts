import { describe, expect, it } from 'vitest'

import {
  DIFFICULTY_LEVELS,
  LICENSE_TYPES,
  TEMPLATE_STATUSES,
  getNextStatuses,
  isValidTransition
} from '@/platform/marketplace/apiTypes'
import type {
  CreateTemplateRequest,
  MarketplaceTemplate,
  UpdateTemplateRequest
} from '@/platform/marketplace/apiTypes'

describe('marketplace API types', () => {
  describe('TemplateStatus', () => {
    it('defines all expected statuses', () => {
      expect(TEMPLATE_STATUSES).toEqual([
        'draft',
        'pending_review',
        'approved',
        'rejected',
        'published',
        'unpublished'
      ])
    })
  })

  describe('state transitions', () => {
    it('allows draft → pending_review via submit', () => {
      expect(isValidTransition('draft', 'pending_review')).toBe(true)
    })

    it('allows pending_review → approved', () => {
      expect(isValidTransition('pending_review', 'approved')).toBe(true)
    })

    it('allows pending_review → rejected', () => {
      expect(isValidTransition('pending_review', 'rejected')).toBe(true)
    })

    it('allows approved → published', () => {
      expect(isValidTransition('approved', 'published')).toBe(true)
    })

    it('allows published → unpublished', () => {
      expect(isValidTransition('published', 'unpublished')).toBe(true)
    })

    it('allows unpublished → published (re-publish)', () => {
      expect(isValidTransition('unpublished', 'published')).toBe(true)
    })

    it('allows rejected → pending_review via resubmit', () => {
      expect(isValidTransition('rejected', 'pending_review')).toBe(true)
    })

    it('rejects draft → approved (skipping review)', () => {
      expect(isValidTransition('draft', 'approved')).toBe(false)
    })

    it('rejects approved → draft', () => {
      expect(isValidTransition('approved', 'draft')).toBe(false)
    })

    it('rejects unpublished → draft', () => {
      expect(isValidTransition('unpublished', 'draft')).toBe(false)
    })

    it('returns correct next statuses for each state', () => {
      expect(getNextStatuses('draft')).toEqual(['pending_review'])
      expect(getNextStatuses('pending_review')).toEqual([
        'approved',
        'rejected'
      ])
      expect(getNextStatuses('approved')).toEqual(['published'])
      expect(getNextStatuses('rejected')).toEqual(['pending_review'])
      expect(getNextStatuses('published')).toEqual(['unpublished'])
      expect(getNextStatuses('unpublished')).toEqual(['published'])
    })
  })

  describe('DifficultyLevel', () => {
    it('defines beginner, intermediate, and advanced', () => {
      expect(DIFFICULTY_LEVELS).toEqual([
        'beginner',
        'intermediate',
        'advanced'
      ])
    })
  })

  describe('LicenseType', () => {
    it('defines all supported license types', () => {
      expect(LICENSE_TYPES).toEqual([
        'cc-by',
        'cc-by-sa',
        'cc-by-nc',
        'mit',
        'apache',
        'custom'
      ])
    })
  })

  describe('type shapes', () => {
    it('MarketplaceTemplate has required fields', () => {
      const template: MarketplaceTemplate = {
        id: 'tpl_1',
        title: 'Test Template',
        description: 'A test template',
        shortDescription: 'Test',
        author: {
          id: 'author_1',
          name: 'Test Author',
          isVerified: false,
          profileUrl: 'https://example.com'
        },
        categories: ['image-gen'],
        tags: ['portrait'],
        difficulty: 'beginner',
        requiredModels: [],
        requiredNodes: [],
        vramRequirement: 4096,
        thumbnail: 'https://example.com/thumb.png',
        gallery: [],
        workflowPreview: 'https://example.com/preview.png',
        license: 'mit',
        version: '1.0.0',
        status: 'draft',
        updatedAt: new Date().toISOString(),
        stats: {
          downloads: 0,
          favorites: 0,
          rating: 0,
          reviewCount: 0,
          weeklyTrend: 0
        }
      }
      expect(template.id).toBe('tpl_1')
      expect(template.status).toBe('draft')
    })

    it('CreateTemplateRequest requires minimal fields', () => {
      const request: CreateTemplateRequest = {
        title: 'My Workflow',
        description: 'Description',
        shortDescription: 'Short desc'
      }
      expect(request.title).toBe('My Workflow')
    })

    it('UpdateTemplateRequest allows partial updates', () => {
      const request: UpdateTemplateRequest = {
        title: 'Updated Title'
      }
      expect(request.title).toBe('Updated Title')
    })
  })
})
