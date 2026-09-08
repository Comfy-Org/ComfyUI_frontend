/**
 * write-story-japanese — writes the machine's Japanese customer stories as
 * `.mdx`.
 *
 * Run: `pnpm i18n:write-story [--dry-run]` (no API key needed).
 *
 * `loadStories` selects by a `<locale>/` id prefix, so a Japanese story is a
 * new file in a new folder and no page changes.
 *
 * All-or-nothing, and here that is not a nicety. The locale fallback is
 * per-collection: once ANY Japanese story exists, `/ja/customers` lists only
 * Japanese ones. Writing nine of eleven would not leave two in English, it
 * would remove them from the page.
 *
 * A Japanese file without a `translatedBy: machine` marker was written by a
 * person and is never touched.
 */
import fs from 'node:fs'
import path from 'node:path'

import { DEFAULT_LOCALE } from '../../src/config/locales'
import {
  buildStory,
  readStories,
  verifyStory
} from '../../src/i18n/pipeline/adapters/story'
import type { Story } from '../../src/i18n/pipeline/adapters/story'
import type { TranslationLayer } from '../../src/i18n/pipeline/types'

const TARGET = 'ja'
const CUSTOMERS_DIR = path.join(process.cwd(), 'src', 'content', 'customers')
const MACHINE_FILE = path.join(
  process.cwd(),
  'src',
  'i18n',
  'content',
  `${TARGET}.json`
)

/**
 * An absent file is fine — nothing has been translated yet. A file that exists
 * but does not parse is not: writing from a half-read layer would publish the
 * wrong stories.
 */
function readMachineLayer(): TranslationLayer {
  let text: string
  try {
    text = fs.readFileSync(MACHINE_FILE, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
  return JSON.parse(text) as TranslationLayer
}

interface Planned {
  slug: string
  file: string
  contents: string
  problems: string[]
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run')
  // A lookup can miss, and the type has to say so or every guard below reads
  // as dead code to a type-aware linter.
  const machine: Readonly<Partial<Record<string, string>>> = readMachineLayer()
  const stories = readStories()

  const english = stories.filter((story) => story.locale === DEFAULT_LOCALE)
  const existing = new Map<string, Story>()
  for (const story of stories) {
    if (story.locale === TARGET) existing.set(story.slug, story)
  }

  const planned: Planned[] = []
  const untranslated: string[] = []
  const skipped: string[] = []

  for (const story of english) {
    const prefix = `story.${story.slug}`
    const title = machine[`${prefix}.title`]
    const category = machine[`${prefix}.category`]
    const description = machine[`${prefix}.description`]
    if (
      title === undefined ||
      category === undefined ||
      description === undefined
    ) {
      untranslated.push(story.slug)
      continue
    }

    const already = existing.get(story.slug)
    if (already && !already.machineWritten) {
      skipped.push(story.slug)
      continue
    }

    // Every section must have a translation. A missing one would fall back to
    // English inside an otherwise Japanese story, which reads worse than the
    // whole page falling back.
    const sections: Record<string, string> = {}
    const sectionBodies: Record<string, string> = {}
    for (const section of story.sections) {
      const label = machine[`${prefix}.section.${section.id}.label`]
      if (label !== undefined) sections[section.id] = label
      const sectionBody = machine[`${prefix}.section.${section.id}.body`]
      if (sectionBody !== undefined) sectionBodies[section.id] = sectionBody
    }

    const between: string[] = []
    for (let index = 0; ; index += 1) {
      const piece = machine[`${prefix}.between.${index}`]
      if (piece === undefined) break
      between.push(piece)
    }

    // A section without a translation would leave English inside an otherwise
    // Japanese story, which reads worse than the page falling back whole.
    const missing = story.sections.filter(
      (section) => !Object.hasOwn(sectionBodies, section.id)
    )
    if (missing.length > 0 && story.sections.length > 0) {
      untranslated.push(story.slug)
      continue
    }

    const contents = buildStory(story, {
      title,
      category,
      description,
      sections,
      sectionBodies,
      between
    })
    planned.push({
      slug: story.slug,
      file: path.join(CUSTOMERS_DIR, TARGET, `${story.slug}.mdx`),
      contents,
      problems: verifyStory(story, contents)
    })
  }

  if (planned.length === 0) {
    process.stdout.write(
      '[i18n] no Japanese for any story yet — run `pnpm i18n:translate` first.\n'
    )
    return
  }

  // Partial coverage removes stories from the page rather than falling back.
  const wanted = english.length - skipped.length
  if (planned.length < wanted) {
    process.stderr.write(
      `[i18n] only ${planned.length} of ${wanted} stories are translated: ` +
        `${untranslated.join(', ')}\n`
    )
    process.stderr.write(
      '[i18n] writing a partial set would drop the rest from /ja/customers. ' +
        'Nothing written.\n'
    )
    process.exit(1)
  }

  const broken = planned.filter((entry) => entry.problems.length > 0)
  if (broken.length > 0) {
    for (const entry of broken) {
      process.stderr.write(`[i18n] ${entry.slug}\n`)
      for (const problem of entry.problems) {
        process.stderr.write(`         ${problem}\n`)
      }
    }
    process.stderr.write(
      `[i18n] ${broken.length} story/stories failed verification. Nothing written.\n`
    )
    process.exit(1)
  }

  for (const slug of skipped) {
    process.stdout.write(`[i18n] ${slug}: left alone, a person wrote it\n`)
  }

  if (dryRun) {
    process.stdout.write(
      `[i18n] dry run: ${planned.length} story/stories to write. Nothing written.\n`
    )
    return
  }

  for (const entry of planned) {
    fs.mkdirSync(path.dirname(entry.file), { recursive: true })
    fs.writeFileSync(entry.file, entry.contents, 'utf8')
  }

  process.stdout.write(
    `[i18n] wrote ${planned.length} Japanese story/stories.\n`
  )
}

main()
