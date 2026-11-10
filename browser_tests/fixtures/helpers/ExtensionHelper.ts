import type { Page } from '@playwright/test'

import type { ComfyExtension } from '@/types/comfy'

/** A test extension with no hooks: only data that survives `page.evaluate`. */
export type DataOnlyExtension = Pick<ComfyExtension, 'name' | 'provenance'>

export class ExtensionHelper {
  constructor(private readonly page: Page) {}

  /** Registers each extension through the app, in order. */
  async register(...extensions: DataOnlyExtension[]): Promise<void> {
    await this.page.evaluate((extensions) => {
      for (const extension of extensions)
        window.app!.registerExtension(extension)
    }, extensions)
  }
}
