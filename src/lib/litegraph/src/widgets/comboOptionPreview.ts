export interface ComboOptionPreviewSource {
  show(value: string, anchor: HTMLElement): void
  hide(): void
}

let source: ComboOptionPreviewSource | undefined

export function provideComboOptionPreviewSource(
  next: ComboOptionPreviewSource | undefined
): void {
  source?.hide()
  source = next
}

export function hasComboOptionPreviewSource(): boolean {
  return source !== undefined
}

export function showComboOptionPreview(
  value: string,
  anchor: HTMLElement
): void {
  source?.show(value, anchor)
}

export function hideComboOptionPreview(): void {
  source?.hide()
}
