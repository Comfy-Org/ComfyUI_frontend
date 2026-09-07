export interface ContentEntry {
  id: string
  canvas: HTMLCanvasElement
  width: number
  height: number
  uploadedUrl: string | null
}

export interface ContentStore {
  register(
    canvas: HTMLCanvasElement,
    opts?: { id?: string; uploadedUrl?: string }
  ): string
  get(id: string): ContentEntry | undefined
  has(id: string): boolean

  dirtyIds(): string[]
  markUploaded(id: string, url: string): void

  collectGarbage(liveIds: Set<string>): void
  totalBytes(): number
}
