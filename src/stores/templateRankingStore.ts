/**
 * Store for template ranking scores.
 * Loads pre-computed usage scores from static JSON.
 * Internal ranks come from template.searchRank in index.json.
 * See docs/TEMPLATE_RANKING.md for details.
 */

import axios from 'axios'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTemplateRankingStore = defineStore('templateRanking', () => {
  const usageScores = ref<Record<string, number>>({})
  const isLoaded = ref(false)

  const loadScores = async (): Promise<void> => {
    if (isLoaded.value) return

    try {
      const response = await axios.get('assets/template-usage-scores.json')
      usageScores.value = response.data
      isLoaded.value = true
    } catch (error) {
      console.error('Error loading template ranking scores:', error)
    }
  }

  /**
   * Get normalized usage score (0-1) for a template.
   */
  const getUsageScore = (templateName: string): number => {
    return usageScores.value[templateName] ?? 0
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
   * Compute composite score for "default" sort.
   * Formula: usage × 0.5 + internal × 0.3 + freshness × 0.2
   */
  const computeDefaultScore = (
    templateName: string,
    dateStr: string | undefined,
    searchRank: number | undefined
  ): number => {
    const usage = getUsageScore(templateName)
    const internal = (searchRank ?? 5) / 10 // Normalize 1-10 to 0-1
    const freshness = computeFreshness(dateStr)

    return usage * 0.5 + internal * 0.3 + freshness * 0.2
  }

  /**
   * Compute composite score for "popular" sort.
   * Formula: usage × 0.9 + freshness × 0.1
   */
  const computePopularScore = (
    templateName: string,
    dateStr: string | undefined
  ): number => {
    const usage = getUsageScore(templateName)
    const freshness = computeFreshness(dateStr)

    return usage * 0.9 + freshness * 0.1
  }

  return {
    isLoaded,
    loadScores,
    getUsageScore,
    computeFreshness,
    computeDefaultScore,
    computePopularScore
  }
})
