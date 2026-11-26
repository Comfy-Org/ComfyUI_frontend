import { markRaw, nextTick } from 'vue'
import { assert, describe, expect, it, vi } from 'vitest'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { DocumentHandle } from '@/platform/nodeApi/v4/types'

function isLoaded(workflow: ComfyWorkflow): workflow is LoadedComfyWorkflow {
  return workflow.changeTracker !== null
}

function load(workflow: ComfyWorkflow): LoadedComfyWorkflow {
  workflow.changeTracker = markRaw(createMockChangeTracker())
  assert(isLoaded(workflow))
  return workflow
}

function openTemporary(name: string): LoadedComfyWorkflow {
  const store = useWorkflowStore()
  const workflow = store.createTemporary(`${name}.json`)
  store.openWorkflowsInBackground({ right: [workflow.path] })
  return load(workflow)
}

function openSaved(name: string): LoadedComfyWorkflow {
  const store = useWorkflowStore()
  const workflow = new ComfyWorkflow({
    path: `workflows/${name}.json`,
    modified: 0,
    size: 0
  })
  store.attachWorkflow(workflow)
  store.openWorkflowsInBackground({ right: [workflow.path] })
  return load(workflow)
}

function show(workflow: LoadedComfyWorkflow) {
  useWorkflowStore().activeWorkflow = workflow
}

function api() {
  return createComfyApi({ getGraph: () => null })
}

describe('the open document', () => {
  it('is undefined before a workflow is open', () => {
    const { comfy } = api()

    expect(comfy.workflow.current()).toBeUndefined()
    expect(comfy.workflow.documentId()).toBeUndefined()
  })

  it('names the workflow on screen, with no path until it is saved', () => {
    const { comfy } = api()
    const unsaved = openTemporary('Draft')
    const saved = openSaved('Portrait')

    show(unsaved)
    const draft = comfy.workflow.current()
    show(saved)
    const portrait = comfy.workflow.current()

    expect(draft).toMatchObject({ name: 'Draft', path: undefined })
    expect(portrait).toMatchObject({
      name: 'Portrait',
      path: 'workflows/Portrait.json',
      isDeleted: false
    })
    expect(Object.isFrozen(portrait)).toBe(true)
    expect(comfy.workflow.documentId()).toBe(portrait?.id)
    expect(draft?.id).not.toBe(portrait?.id)
  })

  it('is the same handle and id through tab switches', () => {
    const { comfy } = api()
    const first = openTemporary('First')
    const second = openTemporary('Second')
    show(first)
    const before = comfy.workflow.current()

    show(second)
    show(first)

    expect(comfy.workflow.current()).toBe(before)
  })

  it('gets a new id when a closed workflow is opened again, and the old handle reports it is gone', async () => {
    const { comfy } = api()
    const workflow = openSaved('Reopened')
    show(workflow)
    const closed = comfy.workflow.current()
    assert(closed)

    await useWorkflowStore().closeWorkflow(workflow)
    useWorkflowStore().openWorkflowsInBackground({ right: [workflow.path] })
    show(load(workflow))

    expect(closed).toMatchObject({
      isDeleted: true,
      name: undefined,
      path: undefined
    })
    expect(comfy.workflow.current()?.id).not.toBe(closed.id)
  })
})

describe('onWorkflowLoaded', () => {
  it('passes the open document each time the host says a workflow loaded', () => {
    const { comfy, host } = api()
    show(openTemporary('Loaded'))
    const loaded: (DocumentHandle | undefined)[] = []
    comfy.onWorkflowLoaded((document) => loaded.push(document))

    host.workflowLoaded()
    host.workflowLoaded()

    expect(loaded).toEqual([comfy.workflow.current(), comfy.workflow.current()])
  })

  it('passes undefined when no workflow is open', () => {
    const { comfy, host } = api()
    const listener = vi.fn()
    comfy.onWorkflowLoaded(listener)

    host.workflowLoaded()

    expect(listener).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it('removes only the registration a disposer came from', () => {
    const { comfy, host } = api()
    const listener = vi.fn()
    const stop = comfy.onWorkflowLoaded(listener)
    comfy.onWorkflowLoaded(listener)

    stop()
    stop()
    host.workflowLoaded()

    expect(listener).toHaveBeenCalledOnce()
  })

  it('refuses a listener that is not a function', () => {
    const { comfy } = api()

    expect(() =>
      Reflect.apply(comfy.onWorkflowLoaded, comfy, ['listener'])
    ).toThrow("onWorkflowLoaded needs a function to call, not 'listener'.")
  })
})

describe('document lifecycle events', () => {
  it('tells a listener when another open document comes on screen', async () => {
    const { comfy } = api()
    const first = openTemporary('First')
    const second = openTemporary('Second')
    show(first)
    const activated: (DocumentHandle | undefined)[] = []
    comfy.onDocumentActivated((document) => activated.push(document))

    show(first)
    await nextTick()

    expect(activated).toEqual([])

    show(second)
    await nextTick()

    expect(activated).toEqual([comfy.workflow.current()])
  })

  it('says nothing when the last open document goes off screen', async () => {
    const { comfy } = api()
    show(openTemporary('Only'))
    const activated = vi.fn()
    comfy.onDocumentActivated(activated)

    useWorkflowStore().activeWorkflow = null
    await nextTick()

    expect(activated).not.toHaveBeenCalled()
  })

  it('tells a listener which document closed, as a deleted handle', async () => {
    const { comfy } = api()
    const staying = openTemporary('Staying')
    const closing = openTemporary('Closing')
    show(closing)
    const handle = comfy.workflow.current()
    show(staying)
    const closed: DocumentHandle[] = []
    comfy.onDocumentClosed((document) => closed.push(document))

    await useWorkflowStore().closeWorkflow(closing)
    await nextTick()

    expect(closed).toEqual([handle])
    expect(closed[0].isDeleted).toBe(true)
  })

  it('counts an open tab whose workflow is not loaded as no document', async () => {
    const { comfy } = api()
    const store = useWorkflowStore()
    const unloaded = store.createTemporary('Unloaded.json')
    store.openWorkflowsInBackground({ right: [unloaded.path] })
    const closed = vi.fn()
    comfy.onDocumentClosed(closed)

    await store.closeWorkflow(unloaded)
    await nextTick()

    expect(closed).not.toHaveBeenCalled()
  })

  it('stops following the workflows once the last listener leaves', async () => {
    const { comfy } = api()
    const first = openTemporary('First')
    const second = openTemporary('Second')
    show(first)
    const activated = vi.fn()
    const closed = vi.fn()
    const stops = [
      comfy.onDocumentActivated(activated),
      comfy.onDocumentClosed(closed)
    ]

    for (const stop of stops) stop()
    show(second)
    await useWorkflowStore().closeWorkflow(first)
    await nextTick()

    expect(activated).not.toHaveBeenCalled()
    expect(closed).not.toHaveBeenCalled()
  })

  it.for(['onDocumentActivated', 'onDocumentClosed'] as const)(
    '%s refuses a listener that is not a function',
    (member) => {
      const { comfy } = api()

      expect(() => Reflect.apply(comfy[member], comfy, [null])).toThrow(
        `${member} needs a function to call, not null.`
      )
    }
  )
})
