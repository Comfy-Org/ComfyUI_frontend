import { describe, expect, it } from 'vitest'

import { AgentRoom } from '@/platform/agent/crdt/agentRoom'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import { bindRoomToLayoutStore } from './bindRoomToLayoutStore'

describe('bindRoomToLayoutStore', () => {
  it('propagates an agent room edit into the real layout store', () => {
    const room = new AgentRoom('wf-1')
    const storeNodes = layoutStore.getYDoc().getMap('nodes')
    const probeId = `agent-probe-${Math.random().toString(36).slice(2)}`
    const versionBefore = layoutStore.getVersion().value

    const unbind = bindRoomToLayoutStore(room)
    room.nodes.set(probeId, { title: 'Agent Node' })

    expect(storeNodes.get(probeId)).toEqual({ title: 'Agent Node' })
    expect(layoutStore.getVersion().value).toBeGreaterThan(versionBefore)

    storeNodes.delete(probeId)
    unbind()
    room.destroy()
  })
})
