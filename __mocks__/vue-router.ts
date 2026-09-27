import { onTestFinished, vi } from 'vitest'
import type { LocationQuery, Router } from 'vue-router'

type VueRouterMock = {
  useRoute: () => { query: LocationQuery }
  useRouter: () => Pick<Router, 'replace'>
}

const query: LocationQuery = {}
const router: Pick<Router, 'replace'> = {
  replace: vi.fn(async () => {})
}

const vueRouter: VueRouterMock = {
  useRoute: vi.fn(() => {
    onTestFinished(() => {
      for (const key of Object.keys(query)) delete query[key]
    })
    return { query }
  }),
  useRouter: vi.fn(() => router)
}

export const { useRoute, useRouter } = vueRouter
