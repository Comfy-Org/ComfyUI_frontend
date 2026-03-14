import { computed, ref } from 'vue'

import type {
  AuthorStats,
  MarketplaceTemplate,
  TemplateStatus
} from '@/platform/marketplace/apiTypes'
import { TEMPLATE_STATUSES } from '@/platform/marketplace/apiTypes'
import { marketplaceService } from '@/platform/marketplace/services/marketplaceService'

export function useAuthorDashboard() {
  const templates = ref<MarketplaceTemplate[]>([])
  const stats = ref<AuthorStats | null>(null)
  const selectedPeriod = ref<'day' | 'week' | 'month'>('week')
  const isLoading = ref(false)
  const isPublishingTemplate = ref<string | null>(null)
  const isUnpublishingTemplate = ref<string | null>(null)
  const error = ref<string | null>(null)

  const templatesByStatus = computed(() => {
    const grouped = Object.fromEntries(
      TEMPLATE_STATUSES.map((s) => [s, [] as MarketplaceTemplate[]])
    ) as Record<TemplateStatus, MarketplaceTemplate[]>

    for (const t of templates.value) {
      const bucket = grouped[t.status]
      if (bucket) bucket.push(t)
    }

    return grouped
  })

  async function loadTemplates(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const result = await marketplaceService.getAuthorTemplates()
      templates.value = result.templates ?? []
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  async function loadStats(period: 'day' | 'week' | 'month'): Promise<void> {
    error.value = null
    try {
      stats.value = await marketplaceService.getAuthorStats(period)
      selectedPeriod.value = period
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function publishTemplate(id: string): Promise<void> {
    error.value = null
    isPublishingTemplate.value = id
    try {
      await marketplaceService.publishTemplate(id)
      await loadTemplates()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isPublishingTemplate.value = null
    }
  }

  async function unpublishTemplate(id: string): Promise<void> {
    error.value = null
    isUnpublishingTemplate.value = id
    try {
      await marketplaceService.unpublishTemplate(id)
      await loadTemplates()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isUnpublishingTemplate.value = null
    }
  }

  return {
    templates,
    stats,
    selectedPeriod,
    isLoading,
    isPublishingTemplate,
    isUnpublishingTemplate,
    error,
    templatesByStatus,
    loadTemplates,
    loadStats,
    publishTemplate,
    unpublishTemplate
  }
}
