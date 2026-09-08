import { describe, expect, it } from 'vitest'

import { hardcodedProse } from './hardcodedCopy'

const page = (frontmatter: string, markup = '<h1>{title}</h1>') =>
  `---\n${frontmatter}\n---\n\n${markup}\n`

/**
 * Copy that escapes the pipeline does not sit in the template — it sits in the
 * TypeScript above it, as data:
 *
 *     const faqs = [{ question: 'What is included in Comfy Enterprise?' }]
 *
 * That renders in every locale and no adapter, report or coverage number can
 * see it, because it has no key. This finds it.
 */
describe('hardcodedProse', () => {
  it('finds a sentence typed into a data structure', () => {
    const found = hardcodedProse(
      page(`const faqs = [
  { question: 'What is included in Comfy Enterprise?' }
]`)
    )

    expect(found).toEqual(['What is included in Comfy Enterprise?'])
  })

  it('finds prose in a default prop value', () => {
    const found = hardcodedProse(
      page(
        `const { description = 'Comfy is the engine for visual professionals.' } = Astro.props`
      )
    )

    expect(found).toEqual(['Comfy is the engine for visual professionals.'])
  })

  it('ignores a Tailwind class list', () => {
    // Long, space-separated, and entirely lowercase — the shape that would
    // otherwise produce a flood of false positives and get the check disabled.
    expect(
      hardcodedProse(
        page(
          `const cls = 'flex items-center justify-between gap-4 py-5 text-left'`
        )
      )
    ).toEqual([])
  })

  it('ignores urls, paths and filenames', () => {
    expect(
      hardcodedProse(
        page(`const a = 'https://comfy.org/contact'
const b = '/p/supported-models/grok-imagine'
const c = 'workflows/try-on.json'`)
      )
    ).toEqual([])
  })

  it('ignores anything too short to be a sentence', () => {
    expect(
      hardcodedProse(page(`const label = 'Read more'\nconst tag = 'BETA'`))
    ).toEqual([])
  })

  it('ignores the markup below the frontmatter', () => {
    // Astro templates legitimately contain text; what matters is whether it
    // came from `t()`, and the template is not where the untracked copy hides.
    expect(
      hardcodedProse(
        page('const x = 1', '<p>This is ordinary body text here</p>')
      )
    ).toEqual([])
  })

  it('returns nothing for a file with no frontmatter', () => {
    expect(hardcodedProse('<h1>Hello there everyone</h1>')).toEqual([])
  })

  it('reports each distinct phrase once', () => {
    const found = hardcodedProse(
      page(`const a = 'Get early access to the Comfy Agent'
const b = 'Get early access to the Comfy Agent'`)
    )

    expect(found).toEqual(['Get early access to the Comfy Agent'])
  })
})
