import type { APIRequestContext, Page } from '@playwright/test'

import { ComfyPage } from './ComfyPage'
import type { FolderStructure } from './ComfyPage'

/**
 * Cloud-specific implementation of ComfyPage.
 * Uses Firebase auth persistence and cloud API for settings.
 */
export class CloudComfyPage extends ComfyPage {
  constructor(page: Page, request: APIRequestContext) {
    super(page, request)
  }

  async setupUser(username: string): Promise<string | null> {
    // No-op for cloud - user already authenticated via Firebase in globalSetup
    // Firebase auth is persisted via storageState in the fixture
    return null
  }

  async setupSettings(settings: Record<string, any>): Promise<void> {
    // Cloud uses batch settings API (not devtools)
    // Firebase auth token is automatically included from restored localStorage
    const resp = await this.request.post(`${this.url}/api/settings`, {
      data: settings
    })

    if (!resp.ok()) {
      throw new Error(`Failed to setup cloud settings: ${await resp.text()}`)
    }
  }

  async setupWorkflowsDirectory(structure: FolderStructure): Promise<void> {
    // Cloud workflow API not yet implemented
    // For initial smoke tests, we can skip this functionality
    console.warn(
      'setupWorkflowsDirectory: not yet implemented for cloud mode - skipping'
    )
  }
}
