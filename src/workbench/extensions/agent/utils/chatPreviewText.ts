const WORKFLOW_REFERENCE_LINK =
  /\[((?:\\.|[^\]\\])*)\]\(workflow:\/\/[^\s)]+\)/g

/** Preview text with workflow links reduced to names and whitespace collapsed. */
export function readablePreview(
  preview: string | undefined
): string | undefined {
  if (!preview) return undefined
  const text = preview
    .replace(WORKFLOW_REFERENCE_LINK, (_match, name: string) =>
      name.replace(/\\([\\[\]])/g, '$1')
    )
    .replace(/\s+/g, ' ')
    .trim()
  return text || undefined
}
