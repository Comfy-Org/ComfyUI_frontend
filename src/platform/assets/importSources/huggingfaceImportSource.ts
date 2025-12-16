import type {
  ImportSourceHandler,
  ImportSourceType
} from '@/platform/assets/types/importSource'

/**
 * Hugging Face model import source handler
 */
class HuggingFaceImportSource implements ImportSourceHandler {
  readonly type: ImportSourceType = 'huggingface'
  readonly name = 'Hugging Face'

  validateUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return (
        hostname === 'huggingface.co' || hostname.endsWith('.huggingface.co')
      )
    } catch {
      return false
    }
  }

  getLabelKey(): string {
    return 'assetBrowser.huggingfaceLinkLabel'
  }

  getPlaceholderKey(): string {
    return 'assetBrowser.huggingfaceLinkPlaceholder'
  }

  getExampleKey(): string {
    return 'assetBrowser.huggingfaceLinkExample'
  }
}

export const huggingfaceImportSource = new HuggingFaceImportSource()
