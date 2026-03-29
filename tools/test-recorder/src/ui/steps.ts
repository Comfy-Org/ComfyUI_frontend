import pc from 'picocolors'

export function stepHeader(current: number, total: number, label: string) {
  console.log()
  console.log(pc.bold(`  ━━━ Step ${current} of ${total}: ${label} ━━━`))
  console.log()
}
