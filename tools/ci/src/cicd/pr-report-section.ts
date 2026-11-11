export interface PrReportSection {
  /** Emoji shown beside the title, e.g. `⚡`. */
  icon: string
  /** Human name of the check, e.g. `Performance`. */
  title: string
  /** Verdict for the heading, e.g. `✅ No regressions`. */
  status: string
  /** Markdown kept visible under the heading, e.g. a failure's next step. */
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
