import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, onTestFinished } from 'vitest'
import { nextTick, ref } from 'vue'

import { createDocuments } from './documents'
import type { DocumentHandle, DocumentSource } from './documents'

const tab = (sessionId: string, more: Partial<DocumentSource> = {}) => ({
  sessionId,
  name: sessionId,
  path: `workflows/${sessionId}.json`,
  ...more
})

function hostWith(initial: DocumentSource[]) {
  const open = ref(initial)
  const documents = createDocuments(() => open.value)
  const events: string[] = []
  const record = (phase: string) => (document: DocumentHandle) =>
    events.push(`${phase} ${document.id}`)
  onTestFinished(documents.onOpened(record('opened')))
  onTestFinished(documents.onActivated(record('activated')))
  onTestFinished(documents.onDeactivated(record('deactivated')))
  onTestFinished(documents.onClosed(record('closed')))
  return { open, documents, events }
}

describe('document sessions', () => {
  it('describes the document on screen and follows it as it changes', () => {
    const open = ref([tab('a', { isActive: true }), tab('b')])
    const { current } = createDocuments(() => open.value)

    const document = current()!

    expect(document).toMatchObject({
      id: 'a',
      name: 'a',
      path: 'workflows/a.json',
      isModified: false,
      isDeleted: false
    })

    open.value = [
      tab('a', {
        isActive: true,
        path: 'workflows/renamed.json',
        isModified: true
      }),
      tab('b')
    ]

    expect(document.path).toBe('workflows/renamed.json')
    expect(document.isModified).toBe(true)
  })

  it('has no current document when none is on screen', () => {
    expect(createDocuments(() => [tab('a')]).current()).toBeUndefined()
    expect(createDocuments().current()).toBeUndefined()
  })

  it('keeps one identity for a document across tab switches', () => {
    const open = ref([tab('a', { isActive: true }), tab('b')])
    const { current } = createDocuments(() => open.value)
    const first = current()

    open.value = [tab('a'), tab('b', { isActive: true })]
    const other = current()
    open.value = [tab('a', { isActive: true }), tab('b')]

    expect(other?.id).toBe('b')
    expect(current()).toBe(first)
    expect(first?.isDeleted).toBe(false)
  })

  it('reports a tab switch as one document leaving the screen, then the other arriving', async () => {
    const { open, events } = hostWith([tab('a', { isActive: true }), tab('b')])

    open.value = [tab('a'), tab('b', { isActive: true })]
    await nextTick()

    expect(events).toEqual(['deactivated a', 'activated b'])
  })

  it('reports a background open without activating it', async () => {
    const { open, events } = hostWith([tab('a', { isActive: true })])

    open.value = [tab('a', { isActive: true }), tab('b')]
    await nextTick()

    expect(events).toEqual(['opened b'])
  })

  it('reports a foreground open as opened, then activated', async () => {
    const { open, events } = hostWith([])

    open.value = [tab('a', { isActive: true })]
    await nextTick()

    expect(events).toEqual(['opened a', 'activated a'])
  })

  it('ends a session on close and gives a reopened file a new one', async () => {
    const { open, documents, events } = hostWith([tab('a', { isActive: true })])
    const closed = documents.current()!

    open.value = []
    await nextTick()
    open.value = [tab('a2', { isActive: true, path: 'workflows/a.json' })]
    await nextTick()

    expect(events).toEqual([
      'deactivated a',
      'closed a',
      'opened a2',
      'activated a2'
    ])
    expect(closed).toMatchObject({
      id: 'a',
      isDeleted: true,
      name: undefined,
      path: undefined
    })
    expect(documents.current()?.isDeleted).toBe(false)
  })

  it('reports nothing for a rename or an edit', async () => {
    const { open, events } = hostWith([tab('a', { isActive: true })])

    open.value = [
      tab('a', { isActive: true, path: 'workflows/b.json', isModified: true })
    ]
    await nextTick()

    expect(events).toEqual([])
  })

  it('reports a listener that throws and still tells the others', async () => {
    const open = ref<DocumentSource[]>([])
    const documents = createDocuments(() => open.value)
    const broken = new Error('pack listener failed')
    const seen: string[] = []
    onTestFinished(
      documents.onOpened(() => {
        throw broken
      })
    )
    onTestFinished(documents.onOpened((document) => seen.push(document.id)))

    open.value = [tab('a')]
    await nextTick()

    expect(seen).toEqual(['a'])
    expect(reportError).toHaveBeenCalledWith(
      broken,
      expect.objectContaining({
        errorType: 'node_api_document_listener_failure',
        tags: { phase: 'opened' }
      })
    )
  })

  it('stops telling a listener once it unsubscribes, and only that one', async () => {
    const open = ref<DocumentSource[]>([])
    const documents = createDocuments(() => open.value)
    const stopped: string[] = []
    const kept: string[] = []
    const stop = documents.onOpened((document) => stopped.push(document.id))
    onTestFinished(documents.onOpened((document) => kept.push(document.id)))

    open.value = [tab('a')]
    await nextTick()
    stop()
    stop()
    open.value = [tab('a'), tab('b')]
    await nextTick()

    expect(stopped).toEqual(['a'])
    expect(kept).toEqual(['a', 'b'])
  })

  it('starts from the documents open when a pack first listens', async () => {
    const open = ref<DocumentSource[]>([tab('a', { isActive: true })])
    const documents = createDocuments(() => open.value)
    const first = documents.onOpened(() => {})
    first()
    open.value = [tab('a', { isActive: true }), tab('b')]
    await nextTick()
    const seen: string[] = []
    onTestFinished(documents.onOpened((document) => seen.push(document.id)))

    open.value = [tab('a', { isActive: true }), tab('b'), tab('c')]
    await nextTick()

    expect(seen).toEqual(['c'])
  })
})
