import fs from 'node:fs'

/**
 * How a content writer was asked to run.
 *
 * `write` puts the plan on disk. `dry-run` reports it and writes nothing.
 * `check` writes nothing and exits non-zero when the plan is not empty, which
 * is how CI refuses a pull request whose generated content is behind the
 * machine layer.
 */
export type WriteMode = 'write' | 'dry-run' | 'check'

export function writeMode(argv: readonly string[] = process.argv): WriteMode {
  if (argv.includes('--check')) return 'check'
  if (argv.includes('--dry-run')) return 'dry-run'
  return 'write'
}

/**
 * The outcome of `--check`: nothing to do is a pass, anything else fails the
 * run and names the script that brings disk back in line.
 */
export function exitCheck(
  current: boolean,
  what: string,
  behind: string,
  command: string
): void {
  if (current) {
    process.stdout.write(`[i18n] ${what} is current with the machine layer.\n`)
    return
  }
  process.stderr.write(
    `[i18n] ${behind}: ${what} is behind the machine layer. ` +
      `Run \`${command}\` and commit the result.\n`
  )
  process.exit(1)
}

/**
 * Whether a document on disk is a person's work. A translation a person wrote
 * or signed off is never overwritten and never withdrawn, whatever the machine
 * layer holds.
 */
export function writtenByPerson(
  document: { machineWritten: boolean } | undefined
): boolean {
  return document !== undefined && !document.machineWritten
}

/**
 * Whether a generated file already holds exactly this content. Byte-identical
 * is not a write, and reporting it as one left a dry run unable to say
 * whether anything had actually changed.
 */
export function alreadyOnDisk(file: string, contents: string): boolean {
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === contents
}
