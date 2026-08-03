/**
 * Store for template ranking scores.
 * Loads pre-computed usage scores from static JSON.
 * Internal ranks come from template.searchRank in index.json.
 * See docs/TEMPLATE_RANKING.md for details.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { searchRankBoost } from '@/composables/templateSearchConfig'

export const useTemplateRankingStore = defineStore('templateRanking', () => {
  const largestUsageScore = ref<number>()

  const normalizeUsageScore = (usage: number): number => {
    const largest = largestUsageScore.value
    return largest ? usage / largest : 0
  }

  /**
   * Compute freshness score based on template date.
   * Returns 1.0 for brand new, decays to 0.1 over ~6 months.
   */
  const computeFreshness = (dateStr: string | undefined): number => {
    if (!dateStr) return 0.5 // Default for templates without dates

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return 0.5

    const daysSinceAdded = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0.1, 1.0 / (1 + daysSinceAdded / 90))
  }

  /**
   * Compute composite score for "recommended" sort.
   * Formula: usage × 0.5 + curation × 0.3 + freshness × 0.2
   */
  const computeDefaultScore = (
    dateStr: string | undefined,
    searchRank: number | undefined,
    usage: number = 0
  ): number => {
    // searchRankBoost is [-1, 1]; shift to [0, 1] so neutral stays the midpoint.
    const curation = (searchRankBoost(searchRank) + 1) / 2
    const freshness = computeFreshness(dateStr)

    return normalizeUsageScore(usage) * 0.5 + curation * 0.3 + freshness * 0.2
  }

  return {
    largestUsageScore,
    computeFreshness,
    computeDefaultScore
  }
})
