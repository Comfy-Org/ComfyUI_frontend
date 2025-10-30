/**
 * Survey Normalization Tests
 *
 * Tests fuzzy matching of free-text survey responses into standard categories
 * using Fuse.js. Tests verify correct categorization, Mixpanel property structure,
 * and that unknown inputs don't force-categorize.
 */

import { describe, expect, it } from 'vitest'

import {
  normalizeIndustry,
  normalizeUseCase,
  normalizeSurveyResponses
} from '../surveyNormalization'

describe('normalizeSurveyResponses - Mixpanel Integration', () => {
  it('should create normalized and raw fields for Mixpanel user properties', () => {
    const result = normalizeSurveyResponses({
      industry: 'Software Development',
      useCase: 'product design'
    })

    expect(result.industry_normalized).toBe('Software / IT / AI')
    expect(result.useCase_normalized).toBe('Product Visualization & Design')
    expect(result.industry_raw).toBe('Software Development')
    expect(result.useCase_raw).toBe('product design')
  })

  it('should preserve all other survey fields unchanged', () => {
    const result = normalizeSurveyResponses({
      industry: 'Film',
      useCase: 'animation',
      familiarity: 'expert',
      making: ['videos', 'images']
    })

    expect(result.familiarity).toBe('expert')
    expect(result.making).toEqual(['videos', 'images'])
    expect(result.industry_normalized).toBe('Film / TV / Animation')
  })

  it('should handle partial responses gracefully', () => {
    const result = normalizeSurveyResponses({
      industry: 'Marketing'
    })

    expect(result.industry_normalized).toBe(
      'Marketing / Advertising / Social Media'
    )
    expect(result.useCase_normalized).toBeUndefined()
  })

  it('should handle completely empty responses', () => {
    const result = normalizeSurveyResponses({})
    expect(result).toEqual({})
  })

  it('should handle responses where both fields are undefined', () => {
    const result = normalizeSurveyResponses({
      industry: undefined,
      useCase: 'other'
    })

    expect(result.industry_normalized).toBeUndefined()
    expect(result.useCase_normalized).toBe('Other / Undefined')
  })
})

describe('normalizeIndustry - Common Inputs', () => {
  it('should categorize exact or near-exact category names', () => {
    expect(normalizeIndustry('Film and television production')).toBe(
      'Film / TV / Animation'
    )
    expect(normalizeIndustry('Marketing & Social Media')).toBe(
      'Marketing / Advertising / Social Media'
    )
    expect(normalizeIndustry('Software Development')).toBe('Software / IT / AI')
    expect(normalizeIndustry('Indie Game Studio')).toBe(
      'Gaming / Interactive Media'
    )
  })

  it('should categorize strong unambiguous keywords', () => {
    expect(normalizeIndustry('animation')).toBe('Film / TV / Animation')
    expect(normalizeIndustry('biotech')).toBe(
      'Healthcare / Medical / Life Science'
    )
    expect(normalizeIndustry('nonprofit')).toBe(
      'Nonprofit / Government / Public Sector'
    )
    expect(normalizeIndustry('game development')).toBe(
      'Gaming / Interactive Media'
    )
  })

  it('should categorize common multi-word industry phrases', () => {
    expect(normalizeIndustry('digital marketing')).toBe(
      'Marketing / Advertising / Social Media'
    )
    expect(normalizeIndustry('web development')).toBe('Software / IT / AI')
    expect(normalizeIndustry('Architecture firm')).toBe(
      'Architecture / Engineering / Construction'
    )
    expect(normalizeIndustry('fashion design')).toBe(
      'Fashion / Beauty / Retail'
    )
    expect(normalizeIndustry('medical research')).toBe(
      'Healthcare / Medical / Life Science'
    )
  })
})

describe('normalizeUseCase - Common Inputs', () => {
  it('should categorize common use case phrases', () => {
    expect(normalizeUseCase('content creation')).toBe(
      'Content Creation & Marketing'
    )
    expect(normalizeUseCase('concept art')).toBe('Art & Illustration')
    expect(normalizeUseCase('product visualization')).toBe(
      'Product Visualization & Design'
    )
  })

  it('should categorize strong unambiguous keywords', () => {
    expect(normalizeUseCase('marketing')).toBe('Content Creation & Marketing')
    expect(normalizeUseCase('photography')).toBe(
      'Photography & Image Processing'
    )
    expect(normalizeUseCase('architecture')).toBe('Architecture & Construction')
  })
})

describe('normalizeIndustry - Fuzzy Matching Behavior', () => {
  it('should handle typos and still categorize', () => {
    const result = normalizeIndustry('animtion')

    expect(result).not.toBe('Other / Undefined')
    expect(result).not.toMatch(/^Uncategorized:/)
  })

  it('should be case-insensitive', () => {
    expect(normalizeIndustry('FILM PRODUCTION')).toBe('Film / TV / Animation')
    expect(normalizeIndustry('software development')).toBe('Software / IT / AI')
    expect(normalizeIndustry('MaRkEtInG')).toBe(
      'Marketing / Advertising / Social Media'
    )
  })

  it('should handle abbreviations and shorthand', () => {
    const results = [
      normalizeIndustry('AI research'),
      normalizeIndustry('movie production'),
      normalizeIndustry('tech startup')
    ]

    results.forEach((result) => {
      expect(result).not.toBe('Other / Undefined')
      expect(result).not.toMatch(/^Uncategorized:/)
    })
  })

  it('should accept reasonable ambiguity for overlapping keywords', () => {
    const result = normalizeIndustry('content creation')
    expect([
      'Marketing / Advertising / Social Media',
      'Fine Art / Contemporary Art'
    ]).toContain(result)
  })
})

describe('normalizeUseCase - Fuzzy Matching Behavior', () => {
  it('should handle variations and related terms', () => {
    const result = normalizeUseCase('social media posts')
    expect(result).toBe('Content Creation & Marketing')
  })

  it('should categorize by finding keyword matches', () => {
    const results = [
      normalizeUseCase('YouTube thumbnails'),
      normalizeUseCase('product mockups'),
      normalizeUseCase('building renderings')
    ]

    results.forEach((result) => {
      expect(result).not.toBe('Other / Undefined')
      expect(result).not.toMatch(/^Uncategorized:/)
    })
  })
})

describe('normalizeIndustry - Edge Cases', () => {
  describe('Empty inputs', () => {
    it('should handle empty strings and whitespace', () => {
      expect(normalizeIndustry('')).toBe('Other / Undefined')
      expect(normalizeIndustry('   ')).toBe('Other / Undefined')
    })
  })

  describe('Placeholder responses', () => {
    it('should recognize common skip/placeholder values', () => {
      expect(normalizeIndustry('other')).toBe('Other / Undefined')
      expect(normalizeIndustry('n/a')).toBe('Other / Undefined')
      expect(normalizeIndustry('none')).toBe('Other / Undefined')
      expect(normalizeIndustry('unknown')).toBe('Other / Undefined')
      expect(normalizeIndustry('not applicable')).toBe('Other / Undefined')
      expect(normalizeIndustry('-')).toBe('Other / Undefined')
    })
  })

  describe('Unknown inputs preservation', () => {
    it('should preserve truly unknown inputs with Uncategorized prefix', () => {
      const input = 'Completely Novel Field That Does Not Match'
      const result = normalizeIndustry(input)

      expect(result).toBe(`Uncategorized: ${input}`)
    })

    it('should not force-categorize inputs with no keyword matches', () => {
      const result = normalizeIndustry('Underwater Basket Weaving Federation')

      expect(result).toMatch(/^Uncategorized:/)
    })
  })
})

describe('normalizeUseCase - Edge Cases', () => {
  it('should handle empty strings and placeholder values', () => {
    expect(normalizeUseCase('')).toBe('Other / Undefined')
    expect(normalizeUseCase('other')).toBe('Other / Undefined')
  })

  it('should preserve unknown use cases with Uncategorized prefix', () => {
    const input = 'Mysterious Novel Use Case'
    const result = normalizeUseCase(input)
    expect(result).toBe(`Uncategorized: ${input}`)
  })
})
