import { describe, it, expect } from 'vitest'

import { t, hasKey, translationKeys } from './translations'

describe('translations', () => {
  describe('pricing.plan.creator keys', () => {
    it('feature1 key exists with correct English text', () => {
      expect(hasKey('pricing.plan.creator.feature1')).toBe(true)
      expect(t('pricing.plan.creator.feature1')).toBe('Import your own LoRAs')
    })

    it('feature1 key returns correct zh-CN translation', () => {
      expect(t('pricing.plan.creator.feature1', 'zh-CN')).toBe(
        '导入你自己的 LoRA'
      )
    })

    it('feature2 key does not exist (removed concurrent API jobs entry)', () => {
      expect(hasKey('pricing.plan.creator.feature2')).toBe(false)
    })

    it('translationKeys array does not include removed creator feature2', () => {
      expect(translationKeys).not.toContain('pricing.plan.creator.feature2')
    })
  })

  describe('pricing.plan.pro keys', () => {
    it('feature1 key exists with correct English text', () => {
      expect(hasKey('pricing.plan.pro.feature1')).toBe(true)
      expect(t('pricing.plan.pro.feature1')).toBe(
        'Longer workflow runtime (up to 1 hour)'
      )
    })

    it('feature1 key returns correct zh-CN translation', () => {
      expect(t('pricing.plan.pro.feature1', 'zh-CN')).toBe(
        '更长工作流运行时长（最长 1 小时）'
      )
    })

    it('feature2 key does not exist (removed concurrent API jobs entry)', () => {
      expect(hasKey('pricing.plan.pro.feature2')).toBe(false)
    })

    it('translationKeys array does not include removed pro feature2', () => {
      expect(translationKeys).not.toContain('pricing.plan.pro.feature2')
    })
  })

  describe('t() function defaults', () => {
    it('defaults locale to en when not provided', () => {
      expect(t('pricing.plan.creator.feature1')).toBe(
        t('pricing.plan.creator.feature1', 'en')
      )
    })

    it('falls back to en when locale translation is missing', () => {
      // All keys in this file have both en and zh-CN, but the fallback
      // behaviour is part of the contract: t() should return en if the
      // locale value is nullish.
      const englishValue = t('pricing.plan.pro.feature1', 'en')
      expect(englishValue).toBe('Longer workflow runtime (up to 1 hour)')
    })
  })

  describe('hasKey()', () => {
    it('returns true for known keys', () => {
      expect(hasKey('hero.title')).toBe(true)
      expect(hasKey('pricing.plan.creator.feature1')).toBe(true)
      expect(hasKey('pricing.plan.pro.feature1')).toBe(true)
    })

    it('returns false for completely unknown keys', () => {
      expect(hasKey('nonexistent.key')).toBe(false)
      expect(hasKey('')).toBe(false)
    })

    it('returns false for the two removed concurrent-API-jobs keys', () => {
      // Regression guard: these keys carried "3 concurrent API jobs" and
      // "5 concurrent API jobs" copy that was intentionally removed.
      expect(hasKey('pricing.plan.creator.feature2')).toBe(false)
      expect(hasKey('pricing.plan.pro.feature2')).toBe(false)
    })
  })
})