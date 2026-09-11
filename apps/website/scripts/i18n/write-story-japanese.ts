/**
 * write-story-japanese — writes the machine's Japanese customer stories as
 * `.mdx`.
 *
 * Run: `pnpm i18n:write-story [--dry-run]` (no API key needed).
 *
 * `loadStories` selects by a `<locale>/` id prefix, so a Japanese story is a
 * new file in a new folder and no page changes.
 *
 * A partial set is written. That used to be refused, because the fallback was
 * per-collection: once ANY Japanese story existed, `/ja/customers` listed only
 * Japanese ones, so writing nine of eleven removed two from the page rather
 * than leaving them in English. `loadStories` merges per story now, so the two
 * show in English and the nine in Japanese, and holding back all eleven for one
 * missing translation only keeps Japanese readers on an English page for longer.
 *
 * A story whose translation is gone is withdrawn — `enforce` rejected it, or
 * the English changed and dropped it as stale. Leaving the file published would
 * make enforcement cosmetic for anything already written.
 *
 * A rejected plan writes nothing, and a write that fails partway is rolled
 * back — files this run created are removed, files it changed are restored.
 * What that does not survive is the process being killed mid-loop; a guarantee
 * there needs an on-disk journal, which is more than a re-runnable script
 * warrants.
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
  sectionsRequiringTranslation,
  verifyStory
} from '../../src/i18n/pipeline/adapters/story'
import type { Story } from '../../src/i18n/pipeline/adapters/story'
import { readTranslationLayer } from '../../src/i18n/pipeline/artifacts'
import { commitAll } from '../../src/i18n/pipeline/commit'
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
  // Also rejects a value that is not a string, which the `as TranslationLayer`
  // assertion here used to wave through into an `.mdx` file typed as `string`.
  return readTranslationLayer(MACHINE_FILE)
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
  const withdrawn: { slug: string; file: string }[] = []

  for (const story of english) {
    const prefix = `story.${story.slug}`

    // Asked first, so a person's story is left alone whatever the machine
    // layer holds — it is never overwritten, and never withdrawn.
    const already = existing.get(story.slug)
    if (already && !already.machineWritten) {
      skipped.push(story.slug)
      continue
    }

    const title = machine[`${prefix}.title`]
    const category = machine[`${prefix}.category`]
    const description = machine[`${prefix}.description`]

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
    //
    // Asked of the body rather than the frontmatter list: a section declared in
    // frontmatter but never opened in the body has no text to translate, so
    // requiring one held the story back forever.
    const missing = sectionsRequiringTranslation(story).filter(
      (id) => !Object.hasOwn(sectionBodies, id)
    )

    const file = path.join(CUSTOMERS_DIR, TARGET, `${story.slug}.mdx`)
    if (
      title === undefined ||
      category === undefined ||
      description === undefined ||
      missing.length > 0
    ) {
      untranslated.push(story.slug)
      // The machine wrote this file from a translation that is now gone, so it
      // is no longer justified. The story falls back to English on the page.
      if (already) withdrawn.push({ slug: story.slug, file })
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
      file,
      contents,
      problems: verifyStory(story, contents)
    })
  }

  if (planned.length === 0 && withdrawn.length === 0) {
    process.stdout.write(
      '[i18n] no Japanese for any story yet — run `pnpm i18n:translate` first.\n'
    )
    return
  }

  if (untranslated.length > 0) {
    process.stdout.write(
      `[i18n] ${untranslated.length} of ${english.length - skipped.length} ` +
        `stories have no complete Japanese: ${untranslated.join(', ')}\n`
    )
    process.stdout.write(
      '[i18n] each falls back to English on /ja/customers.\n'
    )
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
  for (const entry of withdrawn) {
    process.stdout.write(
      `[i18n] ${entry.slug}: withdrawn, its translation is gone\n`
    )
  }

  if (dryRun) {
    process.stdout.write(
      `[i18n] dry run: ${planned.length} story/stories to write, ` +
        `${withdrawn.length} to withdraw. Nothing written.\n`
    )
    return
  }

  // `original` absent means the file is new, so rolling back removes it rather
  // than leaving an empty `.mdx` the site would render as a story with no text.
  commitAll(
    planned.map((entry) => ({
      file: entry.file,
      original: fs.existsSync(entry.file)
        ? fs.readFileSync(entry.file, 'utf8')
        : undefined,
      written: entry.contents
    })),
    {
      write: (file, contents) => {
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, contents, 'utf8')
      },
      remove: (file) => fs.rmSync(file, { force: true })
    }
  )

  // After the writes, so a failed commit rolls back to a page that still has
  // every story it had before this run.
  for (const entry of withdrawn) fs.rmSync(entry.file, { force: true })

  process.stdout.write(
    `[i18n] wrote ${planned.length} Japanese story/stories` +
      (withdrawn.length > 0 ? `, withdrew ${withdrawn.length}` : '') +
      '.\n'
  )
}

main()
