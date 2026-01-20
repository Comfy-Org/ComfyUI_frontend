import { describe, expect, it } from 'vitest'

import {
  FEATURE_SURVEYS,
  getEnabledSurveys,
  getSurveyConfig
} from './surveyRegistry'

describe('surveyRegistry', () => {
  describe('FEATURE_SURVEYS', () => {
    it('is a valid record of survey configs', () => {
      expect(typeof FEATURE_SURVEYS).toBe('object')
      expect(FEATURE_SURVEYS).not.toBeNull()
    })

    it('all configs have required fields', () => {
      for (const [key, config] of Object.entries(FEATURE_SURVEYS)) {
        expect(config.featureId).toBe(key)
        expect(typeof config.typeformId).toBe('string')
        expect(config.typeformId.length).toBeGreaterThan(0)
      }
    })
  })

  describe('getSurveyConfig', () => {
    it('returns undefined for unknown feature', () => {
      expect(getSurveyConfig('nonexistent-feature')).toBeUndefined()
    })

    it('returns config for known feature', () => {
      const testFeatureId = Object.keys(FEATURE_SURVEYS)[0]
      if (testFeatureId) {
        const config = getSurveyConfig(testFeatureId)
        expect(config).toBeDefined()
        expect(config?.featureId).toBe(testFeatureId)
      }
    })
  })

  describe('getEnabledSurveys', () => {
    it('returns array of enabled surveys', () => {
      const enabled = getEnabledSurveys()
      expect(Array.isArray(enabled)).toBe(true)

      for (const config of enabled) {
        expect(config.enabled).not.toBe(false)
      }
    })
  })
})
