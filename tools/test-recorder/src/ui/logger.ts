import pc from 'picocolors'

export function pass(label: string, detail?: string) {
  const d = detail ? pc.dim(` ${detail}`) : ''
  console.log(`  ${pc.green('✅')} ${label}${d}`)
}

export function fail(label: string, detail?: string) {
  const d = detail ? pc.dim(` ${detail}`) : ''
  console.log(`  ${pc.red('❌')} ${label}${d}`)
}

export function warn(label: string, detail?: string) {
  const d = detail ? pc.dim(` ${detail}`) : ''
  console.log(`  ${pc.yellow('⚠️')}  ${label}${d}`)
}

export function info(lines: string[]) {
  for (const line of lines) {
    console.log(`  ${pc.dim('┃')}  ${line}`)
  }
}

export function blank() {
  console.log()
}

export function header(text: string) {
  console.log()
  console.log(pc.bold(`  ━━━ ${text} ━━━`))
  console.log()
}

// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*m/g

/**
 * ANSI escapes occupy no cells and emoji occupy two, so .length skews borders.
 */
export function displayWidth(text: string): number {
  const plain = text.replace(ANSI, '')
  let width = 0
  for (const char of plain) {
    const code = char.codePointAt(0) ?? 0
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1f64f) ||
      (code >= 0x1f900 && code <= 0x1f9ff) ||
      (code >= 0x1f680 && code <= 0x1f6ff)
    // These render into the previous cell.
    if (
      code === 0xfe0f ||
      code === 0xfe0e ||
      (code >= 0x300 && code <= 0x36f)
    ) {
      continue
    }
    width += wide ? 2 : 1
  }
  return width
}

export function box(lines: string[]) {
  if (lines.length === 0) return
  const maxLen = Math.max(...lines.map(displayWidth))
  const border = '─'.repeat(maxLen + 4)
  console.log(`  ┌${border}┐`)
  for (const line of lines) {
    const padding = ' '.repeat(maxLen - displayWidth(line))
    console.log(`  │  ${line}${padding}  │`)
  }
  console.log(`  └${border}┘`)
}

/**
 * For a check that passed loosely enough to break something later — not a
 * skippable style nit. Bordered and red so it reads as "stop and look",
 * distinct from the single dim `warn()` line that scrolls past unnoticed.
 */
export function alert(title: string, lines: string[]) {
  blank()
  const heading = pc.bold(pc.red(`🚨 ${title}`))
  const maxLen = Math.max(displayWidth(heading), ...lines.map(displayWidth))
  const border = '━'.repeat(maxLen + 4)
  console.log(`  ${pc.red(`┏${border}┓`)}`)
  const headingPadding = ' '.repeat(maxLen - displayWidth(heading))
  console.log(`  ${pc.red('┃')}  ${heading}${headingPadding}  ${pc.red('┃')}`)
  for (const line of lines) {
    const padding = ' '.repeat(maxLen - displayWidth(line))
    console.log(`  ${pc.red('┃')}  ${line}${padding}  ${pc.red('┃')}`)
  }
  console.log(`  ${pc.red(`┗${border}┛`)}`)
  blank()
}
