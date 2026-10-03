import { describe, expect, it } from 'vitest'

import { createDocumentHandle } from './documentHandle'
import type { DocumentSource } from './documentHandle'

const source = (overrides: Partial<DocumentSource> = {}): DocumentSource => ({
  sessionId: 'session-a',
  filename: 'portrait',
  path: 'workflows/portrait.json',
  isModified: false,
  ...overrides
})

describe('document handle', () => {
  it('describes the open document', () => {
    const handle = createDocumentHandle('session-a', () => [source()])

    expect(handle.id).toBe('session-a')
    expect(handle.name).toBe('portrait')
    expect(handle.path).toBe('workflows/portrait.json')
    expect(handle.isModified).toBe(false)
    expect(handle.isDeleted).toBe(false)
  })

  it('follows the document rather than snapshotting it', () => {
    // A pack holds the handle and asks again later; an unsaved edit has to be
    // visible, or the answer is only true for the instant it was created.
    let modified = false
    const handle = createDocumentHandle('session-a', () => [
      source({ isModified: modified })
    ])

    modified = true

    expect(handle.isModified).toBe(true)
  })

  it('reports a closed document rather than the one that replaced it', () => {
    // The failure this exists to prevent: a pack keeping a handle across a tab
    // close would otherwise read the next document's name and path through it
    // and act on the wrong file.
    let open: DocumentSource[] = [source()]
    const handle = createDocumentHandle('session-a', () => open)

    open = [
      source({
        sessionId: 'session-b',
        filename: 'landscape',
        path: 'workflows/landscape.json'
      })
    ]

    expect(handle.isDeleted).toBe(true)
    expect(handle.name).toBeUndefined()
    expect(handle.path).toBeUndefined()
    // The id it was minted for stays readable, so a pack can still use it to
    // find and drop whatever it stored under that key.
    expect(handle.id).toBe('session-a')
  })

  it('reports a document closed with nothing open after it', () => {
    let open: DocumentSource[] = [source()]
    const handle = createDocumentHandle('session-a', () => open)

    open = []

    expect(handle.isDeleted).toBe(true)
  })

  it('is frozen, so a pack cannot forge a document identity', () => {
    const handle = createDocumentHandle('session-a', () => [source()])

    expect(Object.isFrozen(handle)).toBe(true)
    expect(() => {
      ;(handle as { id: string }).id = 'session-b'
    }).toThrow()
  })
})
