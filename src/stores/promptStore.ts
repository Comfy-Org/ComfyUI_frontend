import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  createPrompt,
  deletePrompt as deletePromptAsset,
  fetchPromptTemplate,
  fetchPromptVersions,
  fetchPrompts,
  renamePrompt as renamePromptAsset,
  savePromptVersion as savePromptVersionAsset
} from '@/platform/prompts/services/promptService'
import type {
  Prompt,
  PromptTemplate,
  PromptVersion
} from '@/platform/prompts/schemas/promptTypes'

/**
 * Reactive cache of the user's stored prompts. The list is loaded by tag (names
 * only); each prompt's template is loaded lazily from its file content on first
 * use, since the asset list does not include file contents.
 */
export const usePromptStore = defineStore('prompt', () => {
  const promptsById = ref(new Map<string, Prompt>())
  const isLoading = ref(false)
  const hasLoaded = ref(false)

  const prompts = computed(() => [...promptsById.value.values()])

  function getPrompt(id: string): Prompt | undefined {
    return promptsById.value.get(id)
  }

  async function loadPrompts(): Promise<void> {
    if (isLoading.value) return
    isLoading.value = true
    try {
      const fetched = await fetchPrompts()
      promptsById.value = new Map(fetched.map((prompt) => [prompt.id, prompt]))
      hasLoaded.value = true
    } finally {
      isLoading.value = false
    }
  }

  /** Returns a prompt's template, loading the latest version's content lazily. */
  async function resolveTemplate(id: string): Promise<PromptTemplate> {
    const cached = promptsById.value.get(id)
    if (cached?.template.length) return cached.template

    const template = await fetchPromptTemplate(cached?.latestAssetId ?? id)
    const prompt = promptsById.value.get(id)
    if (prompt) promptsById.value.set(id, { ...prompt, template })
    return template
  }

  type PromptInput = {
    name: string
    template: PromptTemplate
    description?: string
  }

  function cachePrompt(prompt: Prompt): Prompt {
    const next = new Map(promptsById.value)
    next.set(prompt.id, prompt)
    promptsById.value = next
    return prompt
  }

  async function savePrompt(input: PromptInput): Promise<Prompt> {
    return cachePrompt(await createPrompt(input))
  }

  /** Saves a new version of an existing prompt, keeping its stable id. */
  async function savePromptVersion(
    id: string,
    input: PromptInput
  ): Promise<Prompt> {
    return cachePrompt(await savePromptVersionAsset(id, input))
  }

  async function deletePrompt(id: string): Promise<void> {
    await deletePromptAsset(id)
    const next = new Map(promptsById.value)
    next.delete(id)
    promptsById.value = next
  }

  async function renamePrompt(id: string, name: string): Promise<void> {
    const prompt = promptsById.value.get(id)
    if (!prompt) return
    await renamePromptAsset(id, prompt.latestAssetId ?? id, name)
    cachePrompt({ ...prompt, name })
  }

  function getVersions(id: string): Promise<PromptVersion[]> {
    return fetchPromptVersions(id)
  }

  /** Loads the content of a specific version asset (for history/restore). */
  function loadVersion(assetId: string): Promise<PromptTemplate> {
    return fetchPromptTemplate(assetId)
  }

  return {
    prompts,
    isLoading,
    hasLoaded,
    getPrompt,
    loadPrompts,
    resolveTemplate,
    savePrompt,
    savePromptVersion,
    deletePrompt,
    renamePrompt,
    getVersions,
    loadVersion
  }
})
