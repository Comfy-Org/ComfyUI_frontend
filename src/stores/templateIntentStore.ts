import { defineStore } from 'pinia'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'

const STORAGE_KEY = 'Comfy.TemplateIntent'

type TemplateIntent = {
  template?: string
  source?: string
}

const readQueryParam = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined
}

const withStorage = (callback: () => void) => {
  try {
    callback()
  } catch (error) {
    console.warn('[templateIntentStore] sessionStorage access failed', error)
  }
}

export const useTemplateIntentStore = defineStore('templateIntent', {
  state: (): TemplateIntent => ({
    template: undefined,
    source: undefined
  }),
  getters: {
    hasIntent: (state) => !!state.template,
    queryParams: (state) => {
      if (!state.template) return {}
      return {
        template: state.template,
        ...(state.source ? { source: state.source } : {})
      }
    }
  },
  actions: {
    hydrateFromStorage() {
      if (this.template) return

      withStorage(() => {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return

        try {
          const parsed = JSON.parse(raw) as TemplateIntent
          if (parsed?.template) {
            this.template = parsed.template
            this.source = parsed.source
          }
        } catch (error) {
          sessionStorage.removeItem(STORAGE_KEY)
          console.warn(
            '[templateIntentStore] invalid sessionStorage payload',
            error
          )
        }
      })
    },
    captureFromQuery(query: LocationQuery) {
      const template = readQueryParam(query.template)
      if (!template) return

      const source = readQueryParam(query.source)

      this.template = template
      this.source = source

      const payload: TemplateIntent = { template, source }
      withStorage(() => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      })
    },
    mergeIntoQuery(query?: LocationQueryRaw) {
      if (!this.hasIntent) return query

      const nextQuery: LocationQueryRaw = { ...(query || {}) }
      const hasTemplate = typeof nextQuery.template === 'string'
      if (hasTemplate) return nextQuery

      return {
        ...nextQuery,
        ...this.queryParams
      }
    },
    clearIntent() {
      this.template = undefined
      this.source = undefined
      withStorage(() => {
        sessionStorage.removeItem(STORAGE_KEY)
      })
    }
  }
})
