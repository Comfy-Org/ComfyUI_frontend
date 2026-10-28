/**
 * Shared shape for every section of the unified PR report comment.
 *
 * A reader scanning the comment should get each check's verdict from one line
 * without scrolling: the heading carries the status, a failure's call to
 * action stays visible beneath it, and everything else is folded away.
 */
export interface PrReportSection {
  /** Emoji shown beside the title, e.g. `⚡`. */
  icon: string
  /** Human name of the check, e.g. `Performance`. */
  title: string
  /** Verdict for the heading, e.g. `✅ No regressions`. */
  status: string
  /**
   * Markdown kept visible under the heading: what to do about a failure, or a
   * caveat on the verdict. Lives outside the box, so GitHub alerts still render.
   */
  notice?: string
  /** Markdown folded into the collapsed box. Omit for a status-only section. */
  body?: string
  /** Label of the collapsed box. Defaults to `Details`. */
  summary?: string
}

export function renderPrReportSection({
  icon,
  title,
  status,
  notice,
  body,
  summary = 'Details'
}: PrReportSection): string {
  const blocks = [`## ${icon} ${title}: ${status}`]

  const trimmedNotice = notice?.trim()
  if (trimmedNotice) blocks.push(trimmedNotice)

  // The blank lines around the body are load-bearing: GitHub only parses
  // Markdown inside an HTML block when it is separated from the tags.
  const trimmedBody = body?.trim()
  if (trimmedBody) {
    blocks.push(
      ['<details>', `<summary>${summary}</summary>`, '', trimmedBody].join(
        '\n'
      ),
      '</details>'
    )
  }

  return blocks.join('\n\n')
}
