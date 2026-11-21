/**
 * The Agent wire is the only producer of `widgets_values_form`.
 *
 * Two modules in this repo decide whether a node's widget form can be proven,
 * and they are not interchangeable:
 *
 * - `provenWidgetValuesForm` here proves the **name-keyed** payload the Agent
 *   wire ships, and `docOpMinter.wireNodeSnapshot` is its one call site
 *   (ADR-WIDGET-SERIALIZATION-0047).
 * - `proveWidgetForm` in `@/lib/litegraph/src/widgets/widgetFormProof` proves
 *   **positional-array** provenance for the registry census, and has no
 *   production caller (ADR-ECS-WIDGETS-0023's 2026-10-26 amendment).
 *
 * Their acceptance policies differ deliberately, and the difference is not a
 * tidying opportunity. A positional array has to be proven identical to the
 * array core produced, because the name/value association is reconstructed
 * from the order and a replaced array silently misassociates every value. The
 * name-keyed payload carries that association itself, so the wire proves the
 * key set instead — and importing the positional identity or class-override
 * refusals into it would refuse valid uncatalogued nodes, which #22505
 * measured as four failing tests and #22508 recorded.
 *
 * Both ADRs state that in prose, and prose is what failed: the second
 * predicate was written two days after the first shipped, under a different
 * ADR, referencing nothing from it. So the rule is asserted here instead —
 * one producer on this seam, and the census predicate stays out of production.
 *
 * The scan covers `src`, which is where `@/` resolves and where both modules
 * live; a caller elsewhere cannot reach the predicate without crossing an
 * import boundary the architecture gate already refuses.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CRDT_DIR = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = resolve(CRDT_DIR, '../../../..')

const ADR =
  'docs/adr/WIDGET-SERIALIZATION-0047-agent-wire-widget-form-is-proven-not-derived.md'

const WIRE_PRODUCER = 'workbench/extensions/agent/crdt/widgetValuesForm.ts'
const WIRE_CALL_SITE = 'workbench/extensions/agent/crdt/docOpMinter.ts'
const CENSUS_PREDICATE = 'lib/litegraph/src/widgets/widgetFormProof.ts'

/** Any import, re-export or dynamic import of a specifier. */
const SPECIFIER = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g

/** Not a production caller: the predicate's own tests and their harness. */
const NOT_PRODUCTION = /\.test\.ts$|\.spec\.ts$|__fixtures__|__mocks__/

function importSpecifiers(text: string): string[] {
  return [...text.matchAll(SPECIFIER)].map(([, specifier]) => specifier)
}

function sourcesUnder(dir: string): { name: string; text: string }[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter(
      (name) =>
        (name.endsWith('.ts') || name.endsWith('.vue')) &&
        !name.includes('node_modules')
    )
    .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }))
}

describe('one widget-form producer', () => {
  const sources = sourcesUnder(SRC_DIR)
  const production = sources.filter(({ name }) => !NOT_PRODUCTION.test(name))

  it('scans the two modules and the wire call site', () => {
    // Without this the guard below passes vacuously if the glob ever breaks.
    expect(sources.map(({ name }) => name)).toEqual(
      expect.arrayContaining([WIRE_PRODUCER, WIRE_CALL_SITE, CENSUS_PREDICATE])
    )
    expect(production.length).toBeGreaterThan(1000)
  })

  it('recognizes every route to the census predicate', () => {
    for (const specifier of [
      '@/lib/litegraph/src/widgets/widgetFormProof',
      './widgetFormProof',
      '../widgets/widgetFormProof'
    ])
      expect(
        importSpecifiers(`import { proveWidgetForm } from '${specifier}'`)
      ).toEqual([specifier])
  })

  it('keeps the census predicate out of production code', () => {
    const callers = production
      .filter(({ name }) => name !== CENSUS_PREDICATE)
      .filter(({ text }) =>
        importSpecifiers(text).some((specifier) =>
          specifier.includes('widgetFormProof')
        )
      )
      .map(({ name }) => name)

    expect(
      callers,
      `${callers.join(', ')} imports the registry census's positional widget-form predicate. The Agent wire is the only producer of widgets_values_form and proves the name-keyed payload instead — see ${ADR}.`
    ).toEqual([])
  })

  it('keeps the two proofs from importing each other', () => {
    const wire = readFileSync(join(SRC_DIR, WIRE_PRODUCER), 'utf8')
    const census = readFileSync(join(SRC_DIR, CENSUS_PREDICATE), 'utf8')

    expect(
      importSpecifiers(wire).filter((specifier) =>
        specifier.includes('widgetFormProof')
      )
    ).toEqual([])
    // The census predicate imports nothing at all, which is what keeps it
    // runnable over a registry dump outside the app.
    expect(importSpecifiers(census)).toEqual([])
  })

  it('leaves the wire call site with exactly one form producer', () => {
    const callSite = readFileSync(join(SRC_DIR, WIRE_CALL_SITE), 'utf8')

    expect(importSpecifiers(callSite)).toContain('./widgetValuesForm')
    expect(callSite).toContain(
      'provenWidgetValuesForm(node, values, serialized)'
    )
  })
})
