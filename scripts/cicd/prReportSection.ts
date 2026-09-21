/**
 * Shared shape for every section of the unified PR report comment.
 *
 * A reader scanning the comment should get each check's verdict from one line
 * without scrolling: the heading carries the status, and everything else is
 * folded away. The Storybook and Playwright sections established the shape and
 * this renderer is how the rest of them keep it.
 */
export interface PrReportSection {
  /** Emoji shown beside the title, e.g. `⚡`. */
  icon: string
  /** Human name of the check, e.g. `Performance`. */
  title: string
  /** Verdict for the heading, e.g. `✅ No regressions`. */
  status: string
  /** Markdown folded into the collapsed box. Omit for a status-only section. */
  body?: string
  /** Text on the disclosure triangle. */
  detailsSummary?: string
}

export function renderPrReportSection({
  icon,
  title,
  status,
  body,
  detailsSummary = 'Details'
}: PrReportSection): string {
  const heading = `## ${icon} ${title}: ${status}`
  const trimmedBody = body?.trim()
  if (!trimmedBody) return heading

  // The blank lines around the body are load-bearing: GitHub only parses
  // Markdown inside an HTML block when it is separated from the tags.
  return [
    heading,
    '',
    '<details>',
    `<summary>${detailsSummary}</summary>`,
    '',
    trimmedBody,
    '',
    '</details>'
  ].join('\n')
}
