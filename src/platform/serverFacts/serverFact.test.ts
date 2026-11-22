import { describe, expect, it } from 'vitest'

import { pendingServerFact } from './pendingServerFact'
import type { ServerFact } from './serverFact'
import { narrowServerFact, receiveServerFact } from './serverFact'

type InviteGate = ServerFact<'can_invite_members'>

function gateInputs(local: boolean, cloud: boolean) {
  return {
    invite: receiveServerFact('can_invite_members', true),
    manage: receiveServerFact('can_manage_members', false),
    local,
    cloud
  }
}

describe('ServerFact', () => {
  it('rejects a recombined fact at a gate typed as the fact', () => {
    const { invite, manage, local, cloud } = gateInputs(true, false)

    // @ts-expect-error a local flag or-ed in can grant the fact
    const orLocal: InviteGate = invite || local
    // @ts-expect-error another fact and-ed in decides the gate too
    const andFact: InviteGate = invite && manage
    // @ts-expect-error the build chooses the provider, not the answer
    const byBuild: InviteGate = cloud ? invite : local
    // @ts-expect-error narrowing goes through narrowServerFact
    const andLocal: InviteGate = invite && !local
    // @ts-expect-error a negated fact is a different question
    const negated: InviteGate = !invite
    // @ts-expect-error a plain boolean is not a fact
    const plain: InviteGate = local
    // @ts-expect-error another field cannot answer this gate
    const otherField: InviteGate = manage

    expect([orLocal, andFact, byBuild, andLocal, negated, plain]).toEqual([
      true,
      false,
      true,
      false,
      false,
      true
    ])
    expect(otherField).toBe(false)
  })

  it.for([
    { fact: true, localAllows: true, rendered: true },
    { fact: true, localAllows: false, rendered: false },
    { fact: false, localAllows: true, rendered: false },
    { fact: false, localAllows: false, rendered: false }
  ])(
    'lets local state withhold but never grant (fact $fact, local $localAllows)',
    ({ fact, localAllows, rendered }) => {
      const gate: InviteGate = narrowServerFact(
        receiveServerFact('can_invite_members', fact),
        localAllows
      )
      expect(gate).toBe(rendered)
    }
  )

  it('yields a fact from the pending bridge only for the gate it fills', () => {
    const { local, cloud } = gateInputs(true, true)
    const bridged: InviteGate = pendingServerFact('BE-123', local && cloud)
    const unplaced = pendingServerFact('BE-123', local)

    // @ts-expect-error a bridge with no gate cannot later fill one
    const late: InviteGate = unplaced

    expect(bridged).toBe(true)
    expect(late).toBe(true)
  })

  it('reads as the value it carries', () => {
    const rendered: boolean = receiveServerFact('can_invite_members', false)
    expect(rendered).toBe(false)
  })
})
