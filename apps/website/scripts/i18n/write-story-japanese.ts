/**
 * write-story-japanese — writes the machine's Japanese customer stories as
 * `.mdx`.
 *
 * Run: `pnpm i18n:write-story [--dry-run | --check]` (no API key needed).
 *
 * `--check` writes nothing and exits non-zero when what is on disk is behind
 * the machine layer. CI runs it on pull requests, so a story that was
 * withdrawn or re-translated cannot merge with its old `.mdx` still published.
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
import { assertValidPlan } from './assert-valid-plan'
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
import {
  alreadyOnDisk,
  exitCheck,
  writeMode,
  writtenByPerson
} from './write-mode'

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

interface StoryWritePlan {
  planned: Planned[]
  untranslated: string[]
  skipped: string[]
  withdrawn: { slug: string; file: string }[]
}

function storyBetween(
  prefix: string,
  machine: Readonly<Partial<TranslationLayer>>
): string[] {
  const between: string[] = []
  for (let index = 0; ; index += 1) {
    const piece = machine[`${prefix}.between.${index}`]
    if (piece === undefined) break
    between.push(piece)
  }

  return between
}

function storySections(
  story: Story,
  machine: Readonly<Partial<TranslationLayer>>
) {
  const prefix = `story.${story.slug}`
  const sections: Record<string, string> = {}
  const sectionBodies: Record<string, string> = {}
  for (const section of story.sections) {
    const label = machine[`${prefix}.section.${section.id}.label`]
    if (label !== undefined) sections[section.id] = label
    const sectionBody = machine[`${prefix}.section.${section.id}.body`]
    if (sectionBody !== undefined) sectionBodies[section.id] = sectionBody
  }

  const between = storyBetween(prefix, machine)
  return { sections, sectionBodies, between }
}

function storyMetadata(
  prefix: string,
  machine: Readonly<Partial<TranslationLayer>>
) {
  const title = machine[`${prefix}.title`]
  const category = machine[`${prefix}.category`]
  const description = machine[`${prefix}.description`]

  if (
    title === undefined ||
    category === undefined ||
    description === undefined
  )
    return undefined
  return { title, category, description }
}

function storyTranslation(
  story: Story,
  machine: Readonly<Partial<TranslationLayer>>
) {
  const prefix = `story.${story.slug}`
  const metadata = storyMetadata(prefix, machine)
  if (!metadata) return undefined

  // Every section must have a translation. A missing one would fall back to
  // English inside an otherwise Japanese story, which reads worse than the
  // whole page falling back.
  const { sections, sectionBodies, between } = storySections(story, machine)

  // A section without a translation would leave English inside an otherwise
  // Japanese story, which reads worse than the page falling back whole.
  //
  // Asked of the body rather than the frontmatter list: a section declared in
  // frontmatter but never opened in the body has no text to translate, so
  // requiring one held the story back forever.
  const missing = sectionsRequiringTranslation(story).filter(
    (id) => !Object.hasOwn(sectionBodies, id)
  )

  return missing.length > 0
    ? undefined
    : { ...metadata, sections, sectionBodies, between }
}

function withdrawStory(
  slug: string,
  file: string,
  already: Story | undefined,
  { untranslated, withdrawn }: StoryWritePlan
): void {
  untranslated.push(slug)
  // The machine wrote this file from a translation that is now gone, so it
  // is no longer justified. The story falls back to English on the page.
  if (already) withdrawn.push({ slug, file })
}

function planStory(
  story: Story,
  already: Story | undefined,
  machine: Readonly<Partial<TranslationLayer>>,
  plan: StoryWritePlan
): void {
  const { planned, skipped } = plan

  // Asked first, so a person's story is left alone whatever the machine
  // layer holds — it is never overwritten, and never withdrawn.
  if (writtenByPerson(already)) {
    skipped.push(story.slug)
    return
  }

  const translation = storyTranslation(story, machine)

  const file = path.join(CUSTOMERS_DIR, TARGET, `${story.slug}.mdx`)
  if (!translation) {
    withdrawStory(story.slug, file, already, plan)
    return
  }

  const contents = buildStory(story, translation)
  if (alreadyOnDisk(file, contents)) return
  planned.push({
    slug: story.slug,
    file,
    contents,
    problems: verifyStory(story, contents)
  })
}

function planStoryWrites(machine: Readonly<Partial<TranslationLayer>>) {
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
    planStory(story, existing.get(story.slug), machine, {
      planned,
      untranslated,
      skipped,
      withdrawn
    })
  }

  return { planned, untranslated, skipped, withdrawn, english }
}

function reportStoryPlan(plan: StoryWritePlan, total: number): void {
  const { planned, untranslated, skipped, withdrawn } = plan
  if (untranslated.length > 0) {
    process.stdout.write(
      `[i18n] ${untranslated.length} of ${total - skipped.length} ` +
        `stories have no complete Japanese: ${untranslated.join(', ')}\n`
    )
    process.stdout.write(
      '[i18n] each falls back to English on /ja/customers.\n'
    )
  }

  assertValidPlan(
    planned.map((entry) => ({ label: entry.slug, problems: entry.problems })),
    'story/stories'
  )

  for (const slug of skipped) {
    process.stdout.write(`[i18n] ${slug}: left alone, a person wrote it\n`)
  }
  for (const entry of withdrawn) {
    process.stdout.write(
      `[i18n] ${entry.slug}: withdrawn, its translation is gone\n`
    )
  }
}

function commitPlannedDocuments(
  planned: Planned[],
  withdrawn: { file: string }[]
): void {
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
}

function reportWritten(planned: Planned[], withdrawn: unknown[]): void {
  process.stdout.write(
    `[i18n] wrote ${planned.length} Japanese story/stories` +
      (withdrawn.length > 0 ? `, withdrew ${withdrawn.length}` : '') +
      '.\n'
  )
}

function main(): void {
  const mode = writeMode()
  // A lookup can miss, and the type has to say so or every guard below reads
  // as dead code to a type-aware linter.
  const machine: Readonly<Partial<Record<string, string>>> = readMachineLayer()
  const { planned, untranslated, skipped, withdrawn, english } =
    planStoryWrites(machine)
  const changes = planned.length + withdrawn.length

  if (mode === 'check') {
    reportStoryPlan(
      { planned, untranslated, skipped, withdrawn },
      english.length
    )
    exitCheck(
      changes === 0,
      'the Japanese story set',
      `${planned.length} story/stories to write and ${withdrawn.length} to withdraw`,
      'pnpm i18n:write-story'
    )
    return
  }

  if (changes === 0) {
    process.stdout.write(
      '[i18n] Japanese stories are current with the machine layer.\n'
    )
    return
  }

  reportStoryPlan({ planned, untranslated, skipped, withdrawn }, english.length)

  if (mode === 'dry-run') {
    process.stdout.write(
      `[i18n] dry run: ${planned.length} story/stories to write, ` +
        `${withdrawn.length} to withdraw. Nothing written.\n`
    )
    return
  }

  commitPlannedDocuments(planned, withdrawn)
  reportWritten(planned, withdrawn)
}

main()
