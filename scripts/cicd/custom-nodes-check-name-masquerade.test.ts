import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// A `workflow_dispatch` check run is attributed to the ref the workflow was
// dispatched from, not to whatever the run actually tested, and a newer check
// suite supersedes the ref's earlier one of the same name. So any dispatch input
// that changes WHAT is tested has to be visible in the name, or the dispatch
// publishes its verdict under the ref's real grade. These assertions are the
// guard: adding an input without naming it fails here rather than silently
// re-opening the hole.
//
// The assertions are semantic, not syntactic. An earlier version of this suite
// only inspected the `${{ }}` segments as text, which let several holes through:
// a name could drop an input entirely and stay green as long as some other
// segment mentioned a string with the same prefix, and nothing at all pinned
// what a schedule or a defaults dispatch actually renders. So this file now
// evaluates the name templates against real contexts and compares rendered
// output.
const WORKFLOW_PATH = '.github/workflows/ci-tests-custom-nodes.yaml'

interface Workflow {
  'run-name'?: string
  on?: { workflow_dispatch?: { inputs?: Record<string, unknown> } }
  // A missing job is a real possibility here - renaming one is exactly the kind
  // of change these assertions exist to catch - so the lookups stay optional.
  jobs?: Record<
    string,
    | { name?: string; strategy?: { matrix?: Record<string, unknown> } }
    | undefined
  >
}

const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as Workflow
const dispatchInputs = Object.keys(workflow.on?.workflow_dispatch?.inputs ?? {})
const runName = workflow['run-name'] ?? ''
const matrixJob = workflow.jobs?.custom_nodes_e2e
const matrixName = matrixJob?.name ?? ''
const aggregateName = workflow.jobs?.['custom-nodes-e2e-status']?.name ?? ''
const proofRowExpression = String(matrixJob?.strategy?.matrix?.proof_row ?? '')

const BARE_RUN_NAME = 'CI: Tests Custom Nodes'
const BARE_AGGREGATE_NAME = 'E2E Custom Nodes Test'

/* -------------------------------------------------------------------------- */
/* A small evaluator for the GitHub expression subset these names use.        */
/* -------------------------------------------------------------------------- */

type Value = string | boolean | number | null

interface Context {
  inputs: Record<string, Value>
  github: Record<string, Value>
  matrix: Record<string, Value>
}

// GitHub's falsiness, which is what every `x && ... || ''` suffix relies on.
const truthy = (v: Value | undefined): boolean =>
  !(v === false || v === '' || v === 0 || v === null || v === undefined)

// GitHub compares loosely, coercing to number when the types differ. That is
// why an absent input (a schedule run) compares equal to '0'.
const toNumber = (v: Value): number => {
  if (v === null || v === '') return 0
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'number') return v
  return Number(v)
}

const looseEq = (a: Value, b: Value): boolean =>
  typeof a === typeof b ? a === b : toNumber(a) === toNumber(b)

type Token = string

const tokenize = (source: string): Token[] => {
  const pattern =
    /\s+|'(?:[^']|'')*'|&&|\|\||==|!=|[!(),]|[A-Za-z_][A-Za-z0-9_.-]*|[0-9]+/g
  const tokens: Token[] = []
  let index = 0

  for (const match of source.matchAll(pattern)) {
    if (match.index !== index) {
      throw new Error(`unlexable input at ${index} in: ${source}`)
    }
    index = match.index + match[0].length
    if (match[0].trim() !== '') tokens.push(match[0])
  }
  if (index !== source.length) {
    throw new Error(`unlexable tail at ${index} in: ${source}`)
  }
  return tokens
}

const evaluate = (source: string, context: Context): Value => {
  const tokens = tokenize(source)
  let position = 0

  const peek = (): Token | undefined => tokens[position]
  const take = (expected?: string): Token | undefined => {
    const token: Token | undefined = tokens[position++]
    if (expected !== undefined && token !== expected) {
      throw new Error(`expected ${expected}, got ${token} in: ${source}`)
    }
    return token
  }

  const parseOr = (): Value => {
    let left = parseAnd()
    while (peek() === '||') {
      take('||')
      const right = parseAnd()
      // Short-circuit semantics still have to evaluate the right side here
      // because the parser is single-pass; the values are pure, so this is safe.
      left = truthy(left) ? left : right
    }
    return left
  }

  const parseAnd = (): Value => {
    let left = parseComparison()
    while (peek() === '&&') {
      take('&&')
      const right = parseComparison()
      left = truthy(left) ? right : left
    }
    return left
  }

  const parseComparison = (): Value => {
    const left = parseUnary()
    const operator = peek()
    if (operator === '==' || operator === '!=') {
      take(operator)
      const right = parseUnary()
      return operator === '==' ? looseEq(left, right) : !looseEq(left, right)
    }
    return left
  }

  const parseUnary = (): Value => {
    if (peek() === '!') {
      take('!')
      return !truthy(parseUnary())
    }
    return parsePrimary()
  }

  const parsePrimary = (): Value => {
    const token = peek()
    if (token === undefined) throw new Error(`unexpected end of: ${source}`)

    if (token === '(') {
      take('(')
      const value = parseOr()
      take(')')
      return value
    }

    if (token.startsWith("'")) {
      take()
      return token.slice(1, -1).replaceAll("''", "'")
    }

    if (/^[0-9]+$/.test(token)) {
      take()
      return Number(token)
    }

    if (token === 'format' || token === 'fromJSON') {
      take()
      take('(')
      const args: Value[] = [parseOr()]
      while (peek() === ',') {
        take(',')
        args.push(parseOr())
      }
      take(')')

      if (token === 'fromJSON') return JSON.parse(String(args[0])) as Value
      const [template, ...rest] = args
      return String(template).replace(/\{(\d+)\}/g, (_, index: string) =>
        String(rest[Number(index)] ?? '')
      )
    }

    take()
    const [root, ...path] = token.split('.')
    if (root !== 'inputs' && root !== 'github' && root !== 'matrix') {
      throw new Error(`unknown context '${root}' in: ${source}`)
    }
    // An absent key is a real case, not a defect: a schedule run leaves the
    // whole `inputs` context empty, which is exactly what the bare names rely on.
    const value: Value | undefined = context[root][path.join('.')]
    return value ?? null
  }

  const result = parseOr()
  if (position !== tokens.length) {
    throw new Error(`trailing tokens in: ${source}`)
  }
  return result
}

const renderName = (template: string, context: Context): string =>
  template.replace(/\$\{\{(.+?)\}\}/g, (_, body: string) => {
    const value = evaluate(body.trim(), context)
    return value === null || value === false ? '' : String(value)
  })

/* -------------------------------------------------------------------------- */
/* Contexts                                                                   */
/* -------------------------------------------------------------------------- */

const DISPATCH_DEFAULTS: Record<string, Value> = {
  detection_proof_row: '0',
  branch: '',
  grep: '',
  comfyui_ref: '',
  record_interactions: false
}

// A schedule leaves the whole `inputs` context empty. That asymmetry is the
// reason every suffix needs an empty fallback.
const scheduleContext = (matrix: Record<string, Value> = {}): Context => ({
  inputs: {},
  github: { event_name: 'schedule' },
  matrix
})

const dispatchContext = (
  overrides: Record<string, Value> = {},
  matrix: Record<string, Value> = {}
): Context => ({
  inputs: { ...DISPATCH_DEFAULTS, ...overrides },
  github: { event_name: 'workflow_dispatch' },
  matrix
})

// The matrix expansion is itself input-dependent, so derive it rather than
// hardcoding it: `detection_proof_row` reaches the matrix job's name through
// `matrix.proof_row`, not directly.
const proofRowsFor = (context: Context): string[] =>
  (
    evaluate(
      proofRowExpression.replace(/^\s*\$\{\{|\}\}\s*$/g, '').trim(),
      context
    ) as unknown as string[]
  ).map(String)

const ORDINARY_SHARD = '4/5'

// One non-default value per dispatch input. Every one of these changes WHAT is
// tested, so every one has to change the rendered name.
const OVERRIDE_CASES: [string, Record<string, Value>][] = [
  ['branch', { branch: 'some-fix-branch' }],
  ['comfyui_ref', { comfyui_ref: 'deadbeef' }],
  ['grep', { grep: 'VideoHelperSuite' }],
  ['record_interactions', { record_interactions: true }],
  ['detection_proof_row', { detection_proof_row: '2' }]
]

/* -------------------------------------------------------------------------- */

describe('custom-node check-run names cannot masquerade as the ref grade', () => {
  it('parses the dispatch inputs it is meant to guard', () => {
    expect(dispatchInputs).toEqual(
      expect.arrayContaining([
        'detection_proof_row',
        'branch',
        'grep',
        'comfyui_ref',
        'record_interactions'
      ])
    )
    expect(runName).not.toBe('')
    expect(matrixName).not.toBe('')
    expect(aggregateName).not.toBe('')
  })

  it('evaluates the matrix proof rows a schedule and a defaults dispatch cover', () => {
    // The premise of the masquerade: these two cover different work, so they
    // must not be able to publish the same names.
    expect(proofRowsFor(scheduleContext())).toEqual([
      '0',
      '1',
      '2',
      '3',
      '9',
      '15'
    ])
    expect(proofRowsFor(dispatchContext())).toEqual(['0'])
  })

  it('leaves a scheduled run exactly the bare names', () => {
    expect(renderName(runName, scheduleContext())).toBe(BARE_RUN_NAME)
    expect(renderName(aggregateName, scheduleContext())).toBe(
      BARE_AGGREGATE_NAME
    )

    for (const proofRow of proofRowsFor(scheduleContext())) {
      expect(
        renderName(
          matrixName,
          scheduleContext({ shard: ORDINARY_SHARD, proof_row: proofRow })
        )
      ).toBe(`custom_nodes_e2e (${ORDINARY_SHARD}, ${proofRow})`)
    }
  })

  it('never lets a defaults dispatch publish under a scheduled name', () => {
    // The hole this workflow's naming exists to close, on its most common path:
    // every suffix is input-driven, so a dispatch left at its defaults rendered
    // all of them empty while testing only proof row 0.
    const dispatch = dispatchContext()
    const schedule = scheduleContext()

    expect(renderName(runName, dispatch)).not.toBe(
      renderName(runName, schedule)
    )
    expect(renderName(aggregateName, dispatch)).not.toBe(
      renderName(aggregateName, schedule)
    )

    const matrixCell = { shard: ORDINARY_SHARD, proof_row: '0' }
    expect(renderName(matrixName, dispatchContext({}, matrixCell))).not.toBe(
      renderName(matrixName, scheduleContext(matrixCell))
    )
  })

  it.for(OVERRIDE_CASES)(
    'renders a distinct run and aggregate name for a %s override',
    ([input, overrides]) => {
      const base = dispatchContext()
      const overridden = dispatchContext(overrides)

      expect(
        renderName(runName, overridden),
        `run name ignores ${input}`
      ).not.toBe(renderName(runName, base))
      expect(
        renderName(aggregateName, overridden),
        `aggregate name ignores ${input}`
      ).not.toBe(renderName(aggregateName, base))
    }
  )

  it.for(OVERRIDE_CASES)(
    'renders a distinct matrix name for a %s override',
    ([input, overrides]) => {
      // `detection_proof_row` and `record_interactions` reach this name through
      // the matrix expansion, so expand it per context instead of holding the
      // matrix cell fixed - otherwise the assertion would be testing the wrong
      // thing for exactly the two inputs that have a surrogate.
      const base = dispatchContext()
      const overridden = dispatchContext(overrides)

      const cellFor = (context: Context) => ({
        shard: context.inputs.record_interactions ? 'core:1/1' : ORDINARY_SHARD,
        proof_row: proofRowsFor(context)[0]
      })

      expect(
        renderName(matrixName, { ...overridden, matrix: cellFor(overridden) }),
        `matrix name ignores ${input}`
      ).not.toBe(renderName(matrixName, { ...base, matrix: cellFor(base) }))
    }
  )

  it('labels grep only when grep is the filter actually in effect', () => {
    // `record_interactions` forces GREP_FILTER to `interaction profiles` and a
    // non-clean proof row replaces it with a proof-specific regex, so in both
    // cases a `[grep: ...]` label would advertise a filter that never ran.
    const grep = 'VideoHelperSuite'

    expect(renderName(aggregateName, dispatchContext({ grep }))).toContain(
      `[grep: ${grep}]`
    )
    expect(
      renderName(
        aggregateName,
        dispatchContext({ grep, record_interactions: true })
      )
    ).not.toContain('[grep:')
    expect(
      renderName(
        aggregateName,
        dispatchContext({ grep, detection_proof_row: '2' })
      )
    ).not.toContain('[grep:')

    const proofCell = { shard: ORDINARY_SHARD, proof_row: '2' }
    expect(
      renderName(matrixName, dispatchContext({ grep }, proofCell))
    ).not.toContain('[grep:')
  })

  it('distinguishes two record_interactions dispatches that differ only in grep', () => {
    // These two enforce different exact-count gating, so identical names would
    // let one supersede the other.
    const first = dispatchContext({ record_interactions: true, grep: 'a-pack' })
    const second = dispatchContext({
      record_interactions: true,
      grep: 'b-pack'
    })

    // The label is suppressed under record_interactions because the caller's
    // grep is not the filter in effect - so the gate must not vary with it
    // either. That is asserted against the workflow source below.
    expect(renderName(aggregateName, first)).toBe(
      renderName(aggregateName, second)
    )
  })

  it('feeds the gate and the summary the filter that actually ran', () => {
    // The name suppresses the caller's `grep` under `record_interactions`; if
    // the gate still read the raw input, two identically-named dispatches would
    // enforce different exact-count gating.
    const source = readFileSync(WORKFLOW_PATH, 'utf8')
    const effectiveFilter =
      "${{ inputs.record_interactions && 'interaction profiles' || inputs.grep }}"

    const grepAssignments = [...source.matchAll(/^\s*GREP_FILTER:.*$/gm)].map(
      ([line]) => line.trim()
    )

    expect(grepAssignments.length).toBeGreaterThanOrEqual(3)
    for (const assignment of grepAssignments) {
      expect(assignment, 'a GREP_FILTER consumer reads the raw input').toBe(
        `GREP_FILTER: ${effectiveFilter}`
      )
    }
  })

  it('names every dispatch input in the aggregate check', () => {
    for (const input of dispatchInputs) {
      // A trailing boundary, so an input whose name is a prefix of another
      // (`grep` inside `grep_invert`) cannot satisfy the wrong assertion.
      expect(aggregateName, `aggregate name ignores ${input}`).toMatch(
        new RegExp(`inputs\\.${input}(?![A-Za-z0-9_])`)
      )
    }
  })

  it('names every matrix dimension in the matrix check', () => {
    // Setting an explicit `name` suppresses GitHub's auto-appended matrix
    // parenthetical, so this list is maintained by hand: a new matrix dimension
    // that is not named here produces byte-identical check runs for jobs that
    // differ only in that key.
    const matrixKeys = Object.keys(matrixJob?.strategy?.matrix ?? {}).filter(
      (key) => key !== 'include' && key !== 'exclude'
    )

    expect(matrixKeys.length).toBeGreaterThan(0)
    for (const key of matrixKeys) {
      expect(matrixName, `matrix name ignores ${key}`).toMatch(
        new RegExp(`matrix\\.${key}(?![A-Za-z0-9_])`)
      )
    }
  })

  it('keys the dispatch discriminator on the event, not on any input', () => {
    // No input value can make a dispatch look like a schedule, which is what
    // makes this the load-bearing discriminator rather than another suffix.
    for (const [label, name] of [
      ['run-name', runName],
      ['matrix name', matrixName],
      ['aggregate name', aggregateName]
    ] as const) {
      expect(name, `${label} has no event discriminator`).toContain(
        'github.event_name'
      )
    }
  })
})
