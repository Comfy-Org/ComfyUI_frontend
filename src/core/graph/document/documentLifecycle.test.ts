import { describe, expect, it } from 'vitest'

import {
  initialDocumentState,
  persistenceOf,
  reduceDocument
} from './documentLifecycle'
import type { DocumentEvent, DocumentTrackingState } from './documentLifecycle'

function run(
  events: readonly DocumentEvent[],
  from: DocumentTrackingState = initialDocumentState
): DocumentTrackingState {
  return events.reduce(reduceDocument, from)
}

describe('reduceDocument', () => {
  it('starts created and unsaved', () => {
    expect(initialDocumentState.phase).toBe('created')
    expect(persistenceOf(initialDocumentState)).toBe('unsaved')
  })

  it('hydrates created to loaded and ignores repeat hydration', () => {
    const loaded = run([{ type: 'hydrated' }])
    expect(loaded.phase).toBe('loaded')
    expect(run([{ type: 'hydrated' }], loaded)).toEqual(loaded)
  })

  it('accumulates mutations while unsaved without changing persistence', () => {
    const state = run([
      { type: 'hydrated' },
      { type: 'mutated' },
      { type: 'mutated' }
    ])
    expect(state.revision).toBe(2)
    expect(persistenceOf(state)).toBe('unsaved')
  })

  it('a completed save makes the document clean only at the captured revision', () => {
    const dirty = run([{ type: 'hydrated' }, { type: 'mutated' }])
    const clean = reduceDocument(dirty, {
      type: 'saveCompleted',
      atRevision: dirty.revision
    })
    expect(persistenceOf(clean)).toBe('clean')
    expect(
      reduceDocument(clean, {
        type: 'saveCompleted',
        atRevision: clean.revision
      })
    ).toBe(clean)
  })

  it('a mutation that commits while a save is in flight leaves the document dirty', () => {
    const beforeSave = run([{ type: 'hydrated' }, { type: 'mutated' }])
    const capturedRevision = beforeSave.revision
    const mutatedDuringSave = reduceDocument(beforeSave, { type: 'mutated' })
    const afterSave = reduceDocument(mutatedDuringSave, {
      type: 'saveCompleted',
      atRevision: capturedRevision
    })
    expect(afterSave.savedRevision).toBe(capturedRevision)
    expect(persistenceOf(afterSave)).toBe('dirty')
  })

  it('ignores a save completion ahead of the live revision or behind the baseline', () => {
    const state = run([
      { type: 'hydrated' },
      { type: 'mutated' },
      { type: 'saveCompleted', atRevision: 1 }
    ])
    expect(
      reduceDocument(state, { type: 'saveCompleted', atRevision: 99 })
    ).toBe(state)
    expect(
      reduceDocument(state, { type: 'saveCompleted', atRevision: 0 })
    ).toBe(state)
  })

  it('remote or human mutations after a save make a loaded document dirty again', () => {
    const state = run([
      { type: 'hydrated' },
      { type: 'mutated' },
      { type: 'saveCompleted', atRevision: 1 },
      { type: 'mutated' }
    ])
    expect(persistenceOf(state)).toBe('dirty')
  })

  it('closes a clean document at its exact revision', () => {
    const state = run([
      { type: 'hydrated' },
      { type: 'mutated' },
      { type: 'saveCompleted', atRevision: 1 },
      { type: 'closed', atRevision: 1, discardChanges: false }
    ])
    expect(state.phase).toBe('closed')
  })

  it('refuses to close a dirty document without an explicit discard decision', () => {
    const dirty = run([{ type: 'hydrated' }, { type: 'mutated' }])
    expect(
      reduceDocument(dirty, {
        type: 'closed',
        atRevision: dirty.revision,
        discardChanges: false
      }).phase
    ).toBe('loaded')
    expect(
      reduceDocument(dirty, {
        type: 'closed',
        atRevision: dirty.revision,
        discardChanges: true
      }).phase
    ).toBe('closed')
  })

  it('treats a close decision as stale when the live revision moved past it', () => {
    const presented = run([{ type: 'hydrated' }, { type: 'mutated' }])
    const decisionRevision = presented.revision
    const moved = reduceDocument(presented, { type: 'mutated' })
    const attempted = reduceDocument(moved, {
      type: 'closed',
      atRevision: decisionRevision,
      discardChanges: true
    })
    expect(attempted.phase).toBe('loaded')
  })

  it('ignores mutation and save events after close', () => {
    const closed = run([
      { type: 'hydrated' },
      { type: 'closed', atRevision: 0, discardChanges: true }
    ])
    expect(reduceDocument(closed, { type: 'mutated' })).toBe(closed)
    expect(
      reduceDocument(closed, { type: 'saveCompleted', atRevision: 0 })
    ).toBe(closed)
  })

  it('cannot close a document that was never loaded', () => {
    const attempted = reduceDocument(initialDocumentState, {
      type: 'closed',
      atRevision: 0,
      discardChanges: true
    })
    expect(attempted.phase).toBe('created')
  })
})
