export type ImportSourceType = 'civitai' | 'huggingface'

export interface ImportSource {
  readonly type: ImportSourceType
  readonly name: string
  readonly hostnames: readonly string[]
}

export const civitaiImportSource: ImportSource = {
  type: 'civitai',
  name: 'Civitai',
  hostnames: ['civitai.com', 'civitai.red']
}

export const huggingfaceImportSource: ImportSource = {
  type: 'huggingface',
  name: 'Hugging Face',
  hostnames: ['huggingface.co']
}

export function validateSourceUrl(url: string, source: ImportSource): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return source.hostnames.some(
      (h) => hostname === h || hostname.endsWith(`.${h}`)
    )
  } catch {
    return false
  }
}
