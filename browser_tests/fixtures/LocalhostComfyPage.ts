import type { APIRequestContext, Page } from '@playwright/test'

import { ComfyPage } from './ComfyPage'
import type { FolderStructure } from './ComfyPage'

/**
 * Localhost-specific implementation of ComfyPage.
 * Uses devtools API and multi-user mode for test isolation.
 */
export class LocalhostComfyPage extends ComfyPage {
  constructor(
    page: Page,
    request: APIRequestContext,
    parallelIndex: number = 0
  ) {
    super(page, request, parallelIndex)
  }

  async setupWorkflowsDirectory(structure: FolderStructure): Promise<void> {
    const resp = await this.request.post(
      `${this.url}/api/devtools/setup_folder_structure`,
      {
        data: {
          tree_structure: this.convertLeafToContent(structure),
          base_path: `user/${this.id}/workflows`
        }
      }
    )

    if (resp.status() !== 200) {
      throw new Error(
        `Failed to setup workflows directory: ${await resp.text()}`
      )
    }

    await this.page.evaluate(async () => {
      await window['app'].extensionManager.workflow.syncWorkflows()
    })
  }

  async setupUser(username: string): Promise<string | null> {
    const res = await this.request.get(`${this.url}/api/users`)
    if (res.status() !== 200)
      throw new Error(`Failed to retrieve users: ${await res.text()}`)

    const apiRes = await res.json()
    const user = Object.entries(apiRes?.users ?? {}).find(
      ([, name]) => name === username
    )
    const id = user?.[0]

    return id ? id : await this.createUser(username)
  }

  private async createUser(username: string): Promise<string> {
    const resp = await this.request.post(`${this.url}/api/users`, {
      data: { username }
    })

    if (resp.status() !== 200)
      throw new Error(`Failed to create user: ${await resp.text()}`)

    return await resp.json()
  }

  async setupSettings(settings: Record<string, any>): Promise<void> {
    const resp = await this.request.post(
      `${this.url}/api/devtools/set_settings`,
      {
        data: settings
      }
    )

    if (resp.status() !== 200) {
      throw new Error(`Failed to setup settings: ${await resp.text()}`)
    }
  }
}
