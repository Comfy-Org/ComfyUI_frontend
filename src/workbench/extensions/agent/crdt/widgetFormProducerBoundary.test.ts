import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CRDT_DIR = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = resolve(CRDT_DIR, '../../../..')

const WIRE_ADR =
  'docs/adr/WIDGET-SERIALIZATION-agent-wire-widget-form-is-proven-not-derived.md'
const CENSUS_ADR =
  'docs/adr/ECS-WIDGETS-widget-entities-with-a-legacy-layer.md (2026-10-26 amendment)'

const WIRE_PRODUCER = 'workbench/extensions/agent/crdt/widgetValuesForm.ts'
const WIRE_CALL_SITE = 'workbench/extensions/agent/crdt/docOpMinter.ts'
const CENSUS_PREDICATE = 'lib/litegraph/src/widgets/widgetFormProof.ts'

const SPECIFIER =
  /(?:from|require|import(?:\.meta\.glob)?)\s*\(?\s*(['"`])([^'"`]+)\1/g
const PRODUCER_CALL = /\bprovenWidgetValuesForm\s*\(/g
const FORM_WRITE = /\bwidgets_values_form\s*:/
const NOT_PRODUCTION = /\.test\.ts$|\.spec\.ts$|__fixtures__|__mocks__/

function importSpecifiers(text: string): string[] {
  return [...text.matchAll(SPECIFIER)].map(([, , specifier]) => specifier)
}

function producerCalls(text: string): number {
  return [...text.matchAll(PRODUCER_CALL)].length
}

function sourcesUnder(dir: string): { name: string; text: string }[] {
  return readdirSync(dir, { recursive: true })
    .map((entry) => String(entry).replaceAll('\\', '/'))
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
    expect(
      sources.map(({ name }) => name),
      'the scan missed a module it is supposed to guard, so every guard below passes vacuously'
    ).toEqual(
      expect.arrayContaining([WIRE_PRODUCER, WIRE_CALL_SITE, CENSUS_PREDICATE])
    )
    expect(production.length).toBeGreaterThan(1000)
  })

  it('recognizes every route to the census predicate', () => {
    const routes = [
      (specifier: string) => `import { proveWidgetForm } from '${specifier}'`,
      (specifier: string) => `export { proveWidgetForm } from '${specifier}'`,
      (specifier: string) => `import '${specifier}'`,
      (specifier: string) => `await import('${specifier}')`,
      (specifier: string) => `await import(\`${specifier}\`)`,
      (specifier: string) => `import.meta.glob('${specifier}')`,
      (specifier: string) => `require('${specifier}')`
    ]

    for (const specifier of [
      '@/lib/litegraph/src/widgets/widgetFormProof',
      './widgetFormProof',
      '../widgets/widgetFormProof'
    ])
      for (const route of routes)
        expect(
          importSpecifiers(route(specifier)),
          `${route(specifier)} is a route to the specifier the guard must see`
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
      `${callers.join(', ')} imports the registry census's positional widget-form predicate. The Agent wire is the only producer of widgets_values_form and proves the name-keyed payload instead, because a name-keyed payload carries the association a positional array reconstructs from its order — see ${WIRE_ADR} and ${CENSUS_ADR}.`
    ).toEqual([])
  })

  it('keeps the two proofs from importing each other', () => {
    const wire = readFileSync(join(SRC_DIR, WIRE_PRODUCER), 'utf8')
    const census = readFileSync(join(SRC_DIR, CENSUS_PREDICATE), 'utf8')

    expect(
      importSpecifiers(wire).filter((specifier) =>
        specifier.includes('widgetFormProof')
      ),
      `${WIRE_PRODUCER} must not borrow the census's positional identity and class-override refusals: they refuse valid uncatalogued nodes on this seam — see ${WIRE_ADR}.`
    ).toEqual([])
    expect(
      importSpecifiers(census),
      `${CENSUS_PREDICATE} imports nothing, which is what keeps it runnable over a registry dump outside the app — see ${CENSUS_ADR}.`
    ).toEqual([])
  })

  it('leaves the wire with one production importer of the form producer', () => {
    const importers = production
      .filter(({ name }) => name !== WIRE_PRODUCER)
      .filter(({ text }) =>
        importSpecifiers(text).some((specifier) =>
          specifier.endsWith('widgetValuesForm')
        )
      )
      .map(({ name }) => name)

    expect(
      importers,
      `${importers.join(', ')} imports the Agent wire's widget-form producer. Only ${WIRE_CALL_SITE} may — see ${WIRE_ADR}.`
    ).toEqual([WIRE_CALL_SITE])
  })

  it('mints the form at exactly one production call site', () => {
    expect(
      readFileSync(join(SRC_DIR, WIRE_PRODUCER), 'utf8'),
      `${WIRE_PRODUCER} no longer declares the producer this guard counts calls to`
    ).toContain('export function provenWidgetValuesForm(')

    const callers = production
      .filter(({ name }) => name !== WIRE_PRODUCER)
      .map(({ name, text }) => ({ name, calls: producerCalls(text) }))
      .filter(({ calls }) => calls > 0)

    expect(
      callers,
      `${JSON.stringify(callers)} calls the Agent wire's widget-form producer. Exactly one call from ${WIRE_CALL_SITE} may — see ${WIRE_ADR}.`
    ).toEqual([{ name: WIRE_CALL_SITE, calls: 1 }])
  })

  it('writes the form field nowhere but the wire call site', () => {
    const writers = production
      .filter(({ text }) => FORM_WRITE.test(text))
      .map(({ name }) => name)

    expect(
      writers,
      `${writers.join(', ')} writes a widgets_values_form field. Only ${WIRE_CALL_SITE} may, and only from the proven form, because a form the reader trusts without a catalogue cannot be hand-built — see ${WIRE_ADR}.`
    ).toEqual([WIRE_CALL_SITE])
  })
})
