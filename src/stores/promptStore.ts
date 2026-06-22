import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  createPrompt,
  fetchPromptTemplate,
  fetchPrompts
} from '@/platform/prompts/services/promptService'
import type {
  Prompt,
  PromptTemplate
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

  /** Returns a prompt's template, loading it from file content if not cached. */
  async function resolveTemplate(id: string): Promise<PromptTemplate> {
    const cached = promptsById.value.get(id)
    if (cached?.template.length) return cached.template

    const template = await fetchPromptTemplate(id)
    const prompt = promptsById.value.get(id)
    if (prompt) promptsById.value.set(id, { ...prompt, template })
    return template
  }

  async function savePrompt(input: {
    name: string
    template: PromptTemplate
    description?: string
  }): Promise<Prompt> {
    const prompt = await createPrompt(input)
    promptsById.value.set(prompt.id, prompt)
    return prompt
  }

  return {
    prompts,
    isLoading,
    hasLoaded,
    getPrompt,
    loadPrompts,
    resolveTemplate,
    savePrompt
  }
})
