import { ref } from 'vue'

import { getAuthorTemplates } from '../services/authorApi'
import type { MarketplaceTemplate } from '../types/marketplace'

const MOCK_AUTHOR_ID = 'mock-user-1'

export function useMyTemplates() {
  const templates = ref<MarketplaceTemplate[]>([])
  const isLoading = ref(false)

  async function refresh() {
    isLoading.value = true
    try {
      const result = await getAuthorTemplates(MOCK_AUTHOR_ID)
      templates.value = result.templates
    } finally {
      isLoading.value = false
    }
  }

  void refresh()

  return { templates, isLoading, refresh }
}
