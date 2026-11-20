import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class OpenOnCloudDialog extends BaseDialog {
  readonly deployHeading: Locator
  readonly deployWithAgentButton: Locator
  readonly missingModelHeading: Locator
  readonly uploadsUnavailableNotice: Locator
  readonly uploadButton: Locator
  readonly runHeading: Locator
  readonly signInNotice: Locator
  readonly openOnCloudButton: Locator
  private readonly agentOptions: readonly Locator[]

  constructor(page: Page) {
    super(
      page,
      page.getByRole('dialog').filter({
        has: page.getByRole('heading', {
          name: /^(Run your workflows on Comfy Cloud|Missing 1 model|Run on Comfy Cloud)$/
        })
      })
    )
    this.deployHeading = this.root.getByRole('heading', {
      name: 'Run your workflows on Comfy Cloud',
      exact: true
    })
    this.deployWithAgentButton = this.root.getByRole('button', {
      name: 'Deploy with your agent',
      exact: true
    })
    this.agentOptions = [
      'Open in Claude desktop',
      'Open in Codex',
      'Copy prompt'
    ].map((name) => page.getByRole('menuitem', { name, exact: true }))
    this.missingModelHeading = this.root.getByRole('heading', {
      name: 'Missing 1 model',
      exact: true
    })
    this.uploadsUnavailableNotice = this.root.getByText(
      'Add these models to Comfy Cloud to run this workflow. Uploads from this ComfyUI are currently unavailable.',
      { exact: true }
    )
    this.uploadButton = this.root.getByRole('button', {
      name: 'Upload',
      exact: true
    })
    this.runHeading = this.root.getByRole('heading', {
      name: 'Run on Comfy Cloud',
      exact: true
    })
    this.signInNotice = this.root.getByText(
      'Comfy Cloud will ask you to sign in.',
      {
        exact: true
      }
    )
    this.openOnCloudButton = this.root.getByRole('button', {
      name: 'Open on Comfy Cloud',
      exact: true
    })
  }

  async expectAgentOptions(): Promise<void> {
    for (const option of this.agentOptions) {
      await expect(option).toBeVisible()
    }
  }

  missingModel(filename: string): Locator {
    return this.root.getByText(filename, { exact: true })
  }
}
