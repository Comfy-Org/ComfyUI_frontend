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

  async read<T>(file: string): Promise<T> {
    const res = await this.request.get(
      `${this.baseUrl}/api/userdata/${encodeURIComponent(file)}`,
      { headers: { 'Comfy-User': this.userId } }
    )
    if (!res.ok())
      throw new Error(
        `Failed to read userdata file "${file}": HTTP ${res.status()}`
      )
    return res.json() as Promise<T>
  }

  async write(file: string, data: unknown): Promise<void> {
    const res = await this.request.post(
      `${this.baseUrl}/api/userdata/${encodeURIComponent(file)}`,
      {
        data,
        headers: { 'Comfy-User': this.userId }
      }
    )
    if (!res.ok())
      throw new Error(
        `Failed to write userdata file "${file}": HTTP ${res.status()}`
      )
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
