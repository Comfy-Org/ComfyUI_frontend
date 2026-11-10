/**
 * Same link shape `parseWorkflowReferences` reads: `[name](workflow://id)`
 * with `\\`, `\[` and `\]` escaped inside the name.
 */
const WORKFLOW_REFERENCE_LINK =
  /\[((?:\\.|[^\]\\])*)\]\(workflow:\/\/[^\s)]+\)/g

/**
 * Display text for a chat's first-message preview: a workflow reference reads
 * as its name instead of markdown link syntax, and line breaks and repeated
 * whitespace collapse so the preview fits one row line. Ordinary markdown is
 * left as typed. Returns undefined when nothing readable remains.
 */
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
