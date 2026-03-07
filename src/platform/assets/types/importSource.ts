type ImportSourceType = 'civitai' | 'huggingface'

export interface ImportSource {
  readonly type: ImportSourceType
  readonly name: string
  readonly hostnames: readonly string[]
}
