import { describe, expect, it, vi } from 'vitest'

import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type * as LinkFixer from '@/utils/linkFixer'
import { fixBadLinks } from '@/utils/linkFixer'

import { useWorkflowValidation } from './useWorkflowValidation'

type SerialisedInput = NonNullable<ISerialisedNode['inputs']>[number]
type SerialisedOutput = NonNullable<ISerialisedNode['outputs']>[number]

const reportError = vi.fn()

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: (...args: unknown[]) => reportError(...args)
}))

vi.mock('@/utils/linkFixer', async (importOriginal) => {
  const actual = await importOriginal<typeof LinkFixer>()
  return { ...actual, fixBadLinks: vi.fn(actual.fixBadLinks) }
})

const createInput = (link: number | null): SerialisedInput =>
  ({
    name: 'in',
    type: '*',
    link
  }) satisfies Partial<SerialisedInput> as SerialisedInput

const createOutput = (links: number[]): SerialisedOutput =>
  ({
    name: 'out',
    type: '*',
    links
  }) satisfies Partial<SerialisedOutput> as SerialisedOutput

function createNode({
  id,
  inputs = [],
  outputs = []
}: {
  id: number
  inputs?: SerialisedInput[]
  outputs?: SerialisedOutput[]
}) {
  return {
    id,
    type: 'TestNode',
    pos: [0, 0],
    size: [100, 100],
    flags: {},
    order: 0,
    mode: 0,
    properties: {},
    inputs,
    outputs
  }
}

function createWorkflow(
  id: string | undefined,
  nodes: ReturnType<typeof createNode>[],
  links: SerialisedLLinkArray[]
): ComfyWorkflowJSON {
  return {
    ...(id ? { id } : {}),
    last_node_id: 2,
    last_link_id: 1,
    nodes,
    links,
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  } as unknown as ComfyWorkflowJSON
}

const intactWorkflow = (id: string) =>
  createWorkflow(
    id,
    [
      createNode({ id: 1, outputs: [createOutput([1])] }),
      createNode({ id: 2, inputs: [createInput(1)] })
    ],
    [[1, 1, 0, 2, 0, '*']]
  )

/** Link 1 targets node 2, which is not in the graph. */
const corruptWorkflow = (id: string) =>
  createWorkflow(
    id,
    [createNode({ id: 1, outputs: [createOutput([1])] })],
    [[1, 1, 0, 2, 0, '*']]
  )

/**
 * Id-less workflows whose corruption differs only in which nodes it names.
 * `patched`/`deleted` counts are identical across them, so a key built from
 * counts alone would report the first and discard the rest. Node ids come from
 * a counter because `reportedCorruption` outlives a test: fixed ids would make
 * a CI retry of a transient failure fail permanently.
 */
let nodeIdSeed = 1000
const unidentifiedCorruptWorkflow = () => {
  const originId = (nodeIdSeed += 2)
  return createWorkflow(
    undefined,
    [createNode({ id: originId, outputs: [createOutput([1])] })],
    [[1, originId, 0, originId + 1, 0, '*']]
  )
}

let workflowCount = 0
const uniqueId = () =>
  `b4e984f1-b421-4d24-b8b4-ff895793a${String(workflowCount++).padStart(3, '0')}`

describe('useWorkflowValidation', () => {
  it('reports the corruption the link fixer found while loading a workflow', async () => {
    await useWorkflowValidation().validateWorkflow(corruptWorkflow(uniqueId()))

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Workflow loaded with corrupt links'
      }),
      expect.objectContaining({
        errorType: 'workflow_link_corruption',
        level: 'warning',
        tags: { unrepaired: false },
        context: expect.objectContaining({ patched: 1, deleted: 1 })
      })
    )
  })

  it('attributes the report to the workflow it came from', async () => {
    const workflowId = uniqueId()

    await useWorkflowValidation().validateWorkflow(corruptWorkflow(workflowId))

    const [, options] = reportError.mock.calls[0] as [
      Error,
      { context: { workflowId: string } }
    ]
    expect(options.context.workflowId).toBe(workflowId)
  })

  it('keeps the diagnostics when validation is silenced', async () => {
    await useWorkflowValidation().validateWorkflow(
      corruptWorkflow(uniqueId()),
      { silent: true }
    )

    const [, options] = reportError.mock.calls[0] as [
      Error,
      { context: { logSample: string[] } }
    ]
    expect(options.context.logSample.length).toBeGreaterThan(0)
  })

  it('reports a corrupt workflow once, not once per reload', async () => {
    const workflowId = uniqueId()
    const validation = useWorkflowValidation()

    await validation.validateWorkflow(corruptWorkflow(workflowId))
    await validation.validateWorkflow(corruptWorkflow(workflowId))

    expect(reportError).toHaveBeenCalledOnce()
  })

  it('does not collapse distinct workflows that carry no id', async () => {
    const validation = useWorkflowValidation()

    await validation.validateWorkflow(unidentifiedCorruptWorkflow())
    await validation.validateWorkflow(unidentifiedCorruptWorkflow())

    expect(reportError).toHaveBeenCalledTimes(2)
  })

  it('stops reporting once the per-session cap is reached', async () => {
    const validation = useWorkflowValidation()

    for (let i = 0; i < 40; i++) {
      await validation.validateWorkflow(unidentifiedCorruptWorkflow())
    }

    expect(reportError.mock.calls.length).toBeLessThanOrEqual(25)
  })

  it('stays quiet for an intact workflow', async () => {
    await useWorkflowValidation().validateWorkflow(intactWorkflow(uniqueId()))

    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports the link fixer throwing rather than only logging it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fixBadLinks).mockImplementation(() => {
      throw new Error('link fixer exploded')
    })

    await useWorkflowValidation().validateWorkflow(intactWorkflow(uniqueId()))

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'link fixer exploded' }),
      expect.objectContaining({ errorType: 'workflow_link_fixer_failure' })
    )
  })
})
