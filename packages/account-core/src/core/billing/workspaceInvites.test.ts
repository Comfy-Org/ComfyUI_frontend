import { describe, expect, it } from 'vitest'

import { createWorkspaceInviteCommands } from './workspaceInvites.js'
import {
  fakeTransport,
  httpOk,
  httpStatus
} from './__fixtures__/billingTestFixtures.js'

const INVITE = {
  id: 'inv_1',
  email: 'ada@example.com',
  invited_at: '2026-09-27T00:00:00Z',
  expires_at: '2026-10-04T00:00:00Z'
}

describe('createWorkspaceInviteCommands', () => {
  it('lists the pending invites of the workspace the token names', async () => {
    const { transport, calls } = fakeTransport([httpOk({ invites: [INVITE] })])
    const result = await createWorkspaceInviteCommands({
      transport
    }).listPendingInvites()

    expect(result).toEqual({ status: 'ok', value: [INVITE] })
    expect(calls[0]).toMatchObject({
      method: 'GET',
      route: '/workspace/invites'
    })
  })

  it('invites one address and returns the invite the server created', async () => {
    const { transport, calls } = fakeTransport([httpOk(INVITE)])
    const result = await createWorkspaceInviteCommands({
      transport
    }).createInvite('ada@example.com')

    expect(result).toEqual({ status: 'ok', value: INVITE })
    expect(calls[0]).toMatchObject({
      method: 'POST',
      route: '/workspace/invites',
      body: { email: 'ada@example.com' }
    })
  })

  it.for([
    ['a refusal', httpStatus(403), 'ACCESS_DENIED'],
    ['an unreadable answer', httpOk({ nope: true }), 'MALFORMED_RESPONSE']
  ] as const)('reports %s as a coded failure', async ([, answer, code]) => {
    const { transport } = fakeTransport([answer])
    const result = await createWorkspaceInviteCommands({
      transport
    }).createInvite('ada@example.com')

    expect(result).toMatchObject({ status: 'error', code })
  })
})
