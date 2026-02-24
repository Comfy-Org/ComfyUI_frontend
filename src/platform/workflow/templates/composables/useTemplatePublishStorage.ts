/**
 * Persists and retrieves the in-progress template being published to the
 * marketplace.
 *
 * Uses {@link setStorageValue} / {@link getStorageValue} so the draft
 * survives page reloads (localStorage) while also being per-tab aware
 * (sessionStorage scoped by clientId).
 */
import type { MarketplaceTemplate } from '@/types/templateMarketplace'

import { getStorageValue, setStorageValue } from '@/scripts/utils'

const STORAGE_KEY = 'Comfy.TemplateMarketplace.TemplateUnderway'

/**
 * Saves a template that is in the process of being published.
 *
 * The template is JSON-serialised and written to both localStorage and
 * the per-tab sessionStorage slot via {@link setStorageValue}.
 *
 * @param template - The current state of the template being published.
 * @throws {TypeError} If the template cannot be serialised to JSON
 *         (e.g. circular references or BigInt values).
 */
export function saveTemplateUnderway(
  template: Partial<MarketplaceTemplate>
): void {
  let json: string
  try {
    json = JSON.stringify(template)
  } catch (error) {
    throw new TypeError(
      `Template cannot be serialised to JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  setStorageValue(STORAGE_KEY, json)
}

/**
 * Retrieves the locally stored in-progress template, if one exists.
 *
 * Reads from the per-tab sessionStorage first, falling back to
 * localStorage, via {@link getStorageValue}.
 *
 * @returns The partially completed template, or `null` when no draft
 *          is stored or the stored value cannot be parsed.
 */
export function loadTemplateUnderway(): Partial<MarketplaceTemplate> | null {
  const raw = getStorageValue(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as Partial<MarketplaceTemplate>
  } catch {
    return null
  }
}
