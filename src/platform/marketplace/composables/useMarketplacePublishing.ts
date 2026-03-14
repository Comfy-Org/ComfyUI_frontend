import { ref } from 'vue'

import type {
  Category,
  CreateTemplateRequest,
  MarketplaceTemplate,
  MediaUploadResponse,
  SubmitTemplateResponse,
  UpdateTemplateRequest
} from '@/platform/marketplace/apiTypes'
import { marketplaceService } from '@/platform/marketplace/services/marketplaceService'

export function useMarketplacePublishing() {
  const currentStep = ref(1)
  const draftId = ref<string | null>(null)
  const isPublishing = ref(false)
  const error = ref<string | null>(null)
  const categories = ref<Category[]>([])
  const tagSuggestions = ref<string[]>([])

  async function createDraft(req: CreateTemplateRequest): Promise<void> {
    error.value = null
    try {
      const result = await marketplaceService.createTemplate(req)
      draftId.value = result.id
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function saveDraft(updates: UpdateTemplateRequest): Promise<void> {
    if (!draftId.value) return

    error.value = null
    try {
      await marketplaceService.updateTemplate(draftId.value, updates)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function uploadMedia(
    file: File
  ): Promise<MediaUploadResponse | undefined> {
    if (!draftId.value) return undefined

    error.value = null
    try {
      return await marketplaceService.uploadTemplateMedia(draftId.value, file)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return undefined
    }
  }

  async function submit(): Promise<SubmitTemplateResponse | undefined> {
    if (!draftId.value) return undefined

    isPublishing.value = true
    error.value = null
    try {
      return await marketplaceService.submitTemplate(draftId.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return undefined
    } finally {
      isPublishing.value = false
    }
  }

  function goToStep(step: number): void {
    currentStep.value = step
  }

  function nextStep(): void {
    currentStep.value++
  }

  function prevStep(): void {
    if (currentStep.value > 1) {
      currentStep.value--
    }
  }

  function reset(): void {
    currentStep.value = 1
    draftId.value = null
    isPublishing.value = false
    error.value = null
    categories.value = []
    tagSuggestions.value = []
  }

  function loadForEdit(template: MarketplaceTemplate): void {
    reset()
    draftId.value = template.id
    currentStep.value = 1
  }

  async function loadCategories(): Promise<void> {
    try {
      const result = await marketplaceService.getCategories()
      categories.value = result.categories
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function loadTagSuggestions(
    query: string,
    nodeTypes?: string[]
  ): Promise<void> {
    try {
      const result = await marketplaceService.suggestTags(query, nodeTypes)
      tagSuggestions.value = result.tags
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  return {
    currentStep,
    draftId,
    isPublishing,
    error,
    categories,
    tagSuggestions,
    createDraft,
    saveDraft,
    uploadMedia,
    submit,
    goToStep,
    nextStep,
    prevStep,
    reset,
    loadForEdit,
    loadCategories,
    loadTagSuggestions
  }
}
