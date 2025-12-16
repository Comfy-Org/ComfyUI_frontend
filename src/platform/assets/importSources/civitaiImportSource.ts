import type {
  ImportSourceHandler,
  ImportSourceType
} from '@/platform/assets/types/importSource'

/**
 * Civitai model import source handler
 */
class CivitaiImportSource implements ImportSourceHandler {
  readonly type: ImportSourceType = 'civitai'
  readonly name = 'Civitai'

  validateUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return hostname === 'civitai.com' || hostname.endsWith('.civitai.com')
    } catch {
      return false
    }
  }
}

export const civitaiImportSource = new CivitaiImportSource()
