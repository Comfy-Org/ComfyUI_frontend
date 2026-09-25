import { beforeEach, describe, expect, it } from 'vitest'
import {
  readCinematicJournal,
  removeCinematicJournal,
  writeCinematicJournal
} from './journal'

beforeEach(() => localStorage.clear())

describe('cinematic request journal', () => {
  it('keeps unknown submissions separate from admitted requests without retaining secrets', () => {
    const entry = {
      id: crypto.randomUUID(),
      modelSlug: 'model--route',
      contractId: 'provider/model',
      prompt: 'A quiet street',
      aspect: '16:9' as const,
      startedAt: 100,
      status: 'unknown' as const,
      token: 'must-not-retain'
    }
    writeCinematicJournal('alice/workspace', entry)
    expect(readCinematicJournal('bob/workspace')).toEqual([])
    expect(readCinematicJournal('alice/workspace')[0]).not.toHaveProperty(
      'token'
    )
    expect(readCinematicJournal('alice/workspace')[0].requestId).toBeUndefined()
    const requestId = crypto.randomUUID()
    writeCinematicJournal('alice/workspace', {
      ...entry,
      requestId,
      status: 'pending'
    })
    expect(readCinematicJournal('alice/workspace')).toEqual([
      expect.objectContaining({ requestId, status: 'pending' })
    ])
    removeCinematicJournal('alice/workspace', entry.id)
    expect(readCinematicJournal('alice/workspace')).toEqual([])
  })
  it('rejects malformed or redirected request identities', () => {
    expect(() =>
      writeCinematicJournal('alice', {
        id: crypto.randomUUID(),
        modelSlug: '../other',
        contractId: 'provider/model',
        prompt: 'Scene',
        aspect: '16:9',
        startedAt: 1,
        status: 'pending',
        requestId: 'not-an-id'
      })
    ).toThrow()
    expect(readCinematicJournal('alice')).toEqual([])
  })
})
