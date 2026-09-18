import { onTestFinished, vi } from 'vitest'
import type { LocationQuery, Router } from 'vue-router'

const query: LocationQuery = {}
const router: Pick<Router, 'replace'> = {
  replace: vi.fn<Router['replace']>(async () => {})
}

export const useRoute = vi.fn(() => {
  onTestFinished(() => {
    for (const key of Object.keys(query)) delete query[key]
  })
  return { query }
})

export const useRouter = vi.fn(() => router)
