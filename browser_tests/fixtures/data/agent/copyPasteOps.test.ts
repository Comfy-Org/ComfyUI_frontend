import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { zAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import {
  saveImageAddNodeOp,
  setWidgetOp
} from '@e2e/fixtures/data/agent/copyPasteOps'

const CASE = 'agent-rec-three-sequential-adds'
const COLLIDING_ID = 2514973844700533

describe('copy/paste repro ops', () => {
  it('apply through the library onto the recording they extend', () => {
    // import.meta.url is not a file URL under vitest, so the loader is bypassed.
    const conversation = zAgentConversation.parse(
      JSON.parse(
        readFileSync(
          join(
            process.cwd(),
            'browser_tests/fixtures/data/agent/conversations',
            `${CASE}.json`
          ),
          'utf8'
        )
      )
    )
    const { workflow } = conversation
    const host = new HostDoc(workflow.id, workflow.seed, workflow.catalog)
    for (const turn of conversation.turns)
      for (const entry of turn.response)
        if (entry.kind === 'graph_ops') host.apply(entry.ops)

    host.apply([saveImageAddNodeOp(COLLIDING_ID, [2900, 400])])
    host.apply([setWidgetOp(3, 'steps', 20, 25)])

    const projected = host.projection()
    expect(
      projected.nodes.find((node) => String(node.id) === String(COLLIDING_ID))
    ).toMatchObject({ type: 'SaveImage', widgets_values: ['ComfyUI'] })
    expect(
      projected.nodes.find((node) => String(node.id) === '3')?.widgets_values
    ).toContain(25)
  })
})
