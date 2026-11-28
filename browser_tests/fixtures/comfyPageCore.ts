import type { Page } from '@playwright/test'

/** The ComfyPage members a fixture helper can depend on without importing ComfyPage. */
export interface ComfyPageCore {
  readonly page: Page
  nextFrame(): Promise<void>
}
