export function assertValidPlan(
  entries: { label: string; problems: string[] }[],
  unit: string
): void {
  const broken = entries.filter((entry) => entry.problems.length > 0)
  if (broken.length === 0) return
  for (const entry of broken) {
    process.stderr.write(`[i18n] ${entry.label}\n`)
    for (const problem of entry.problems)
      process.stderr.write(`         ${problem}\n`)
  }
  process.stderr.write(
    `[i18n] ${broken.length} ${unit} failed verification. Nothing written.\n`
  )
  process.exit(1)
}
