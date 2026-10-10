import type { APIRequestContext } from '@playwright/test'

/**
 * Interact with the ComfyUI per-user storage (`/api/userdata/...`) from
 * outside the browser context. Useful for test setup/teardown that needs
 * to reset server-persisted state (node templates, keybinding presets, etc.)
 * without reloading the app.
 */
export class UserDataHelper {
  constructor(
    private readonly request: APIRequestContext,
    private readonly userId: string,
    private readonly baseUrl: string
  ) {}

  /**
   * Read a per-user file as text, straight from the server.
   *
   * This is the cheap way to prove something was durably saved: it needs no app
   * boot, and unlike reading the value back in the browser it cannot be satisfied
   * by a restored local draft. Returns null when the file does not exist, so a
   * test can distinguish "never written" from "written empty".
   */
  async readText(file: string): Promise<string | null> {
    const res = await this.request.fetch(
      `${this.baseUrl}/api/userdata/${encodeURIComponent(file)}`,
      { headers: { 'Comfy-User': this.userId } }
    )
    if (res.status() === 404) return null
    if (!res.ok())
      throw new Error(
        `Failed to read userdata file "${file}": HTTP ${res.status()}`
      )
    return res.text()
  }

  async delete(file: string): Promise<void> {
    const res = await this.request.fetch(
      `${this.baseUrl}/api/userdata/${encodeURIComponent(file)}`,
      { method: 'DELETE', headers: { 'Comfy-User': this.userId } }
    )
    if (!res.ok() && res.status() !== 404)
      throw new Error(
        `Failed to delete userdata file "${file}": HTTP ${res.status()}`
      )
  }
}
