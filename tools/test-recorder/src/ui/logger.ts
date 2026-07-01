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

export function box(lines: string[]) {
  if (lines.length === 0) return
  const maxLen = Math.max(...lines.map((l) => l.length))
  const border = '─'.repeat(maxLen + 4)
  console.log(`  ┌${border}┐`)
  for (const line of lines) {
    console.log(`  │  ${line.padEnd(maxLen + 2)}│`)
  }
  console.log(`  └${border}┘`)
}
