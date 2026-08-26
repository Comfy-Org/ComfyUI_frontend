export interface TemplateRecency {
  timestamp: number
  index: number
}

interface PreviewTarget {
  previewTemplate?: string
  previewRecency?: TemplateRecency
}

export function setNewestPreview(
  target: PreviewTarget,
  templateName: string,
  recency: TemplateRecency
): void {
  const current = target.previewRecency
  if (
    current &&
    (current.timestamp > recency.timestamp ||
      (current.timestamp === recency.timestamp &&
        current.index <= recency.index))
  ) {
    return
  }

  target.previewTemplate = templateName
  target.previewRecency = recency
}
