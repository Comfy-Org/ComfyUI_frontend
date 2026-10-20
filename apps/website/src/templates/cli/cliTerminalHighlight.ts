import { highlightTokens } from '@/lib/highlight'
import type { HighlightToken } from '@/lib/highlight'
import type { TerminalLine } from './cliTerminalSequences'

export function terminalTokens(
  line: TerminalLine,
  visibleText: string
): readonly HighlightToken[] {
  if (line.kind === 'ok')
    return [{ content: visibleText, color: 'var(--color-terminal-success)' }]

  const isCommand = line.kind === 'cmd'
  const tokens = isCommand
    ? highlightTokens(line.text, 'shell')
    : line.text.trimStart().startsWith('{')
      ? highlightTokens(line.text, 'json')
      : null
  const prefix = isCommand
    ? [{ content: '$ ', color: 'var(--color-primary-comfy-yellow)' }]
    : []
  const fullTokens = [...prefix, ...(tokens ?? [{ content: line.text }])]
  let remaining = visibleText.length
  return fullTokens.flatMap((token) => {
    const content = token.content.slice(0, remaining)
    remaining = Math.max(0, remaining - token.content.length)
    return content ? [{ ...token, content }] : []
  })
}
