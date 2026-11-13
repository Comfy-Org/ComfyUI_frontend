import { watch } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createUuidv4 } from '@/utils/uuid'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { createListeners } from '@/platform/nodeApi/shared/listeners'
import type { DocumentHandle, Unsubscribe } from '@/platform/nodeApi/v4/types'

type Session = NonNullable<ComfyWorkflow['changeTracker']>

interface Documents {
  current(): DocumentHandle | undefined
  onWorkflowLoaded(
    listener: (document: DocumentHandle | undefined) => void
  ): Unsubscribe
  onDocumentActivated(listener: (document: DocumentHandle) => void): Unsubscribe
  onDocumentClosed(listener: (document: DocumentHandle) => void): Unsubscribe
  /** Tells packs a workflow finished loading, or an undo or redo restored one. */
  workflowLoaded(): void
}

/** Open documents, one per editing session: a workflow from open until close. */
export function createDocuments(): Documents {
  const handles = new WeakMap<Session, DocumentHandle>()
  const loaded =
    createListeners<[DocumentHandle | undefined]>('onWorkflowLoaded')

  function handleFor(session: Session): DocumentHandle {
    let handle = handles.get(session)
    if (!handle) {
      handle = documentHandle(createUuidv4(), () => openWorkflowOf(session))
      handles.set(session, handle)
    }
    return handle
  }

  function current(): DocumentHandle | undefined {
    const session = useWorkflowStore().activeWorkflow?.changeTracker
    return session ? handleFor(session) : undefined
  }

  return {
    current,
    onWorkflowLoaded(listener) {
      if (typeof listener !== 'function') {
        throw invalidArgument(
          'onWorkflowLoaded',
          'a function to call',
          listener
        )
      }
      return loaded.add(listener)
    },
    onDocumentActivated: createHostEvent<[DocumentHandle]>(
      'onDocumentActivated',
      (emit) =>
        watch(
          () => useWorkflowStore().activeWorkflow?.changeTracker,
          (session) => {
            if (session) emit(handleFor(session))
          }
        )
    ),
    onDocumentClosed: createHostEvent<[DocumentHandle]>(
      'onDocumentClosed',
      (emit) =>
        watch(openSessions, (open, wasOpen) => {
          for (const session of wasOpen) {
            if (!open.includes(session)) emit(handleFor(session))
          }
        })
    ),
    workflowLoaded: () => loaded.notify(current())
  }
}

function openSessions(): Session[] {
  return useWorkflowStore().openWorkflows.flatMap(
    ({ changeTracker }) => changeTracker ?? []
  )
}

function openWorkflowOf(session: Session): ComfyWorkflow | undefined {
  return useWorkflowStore().openWorkflows.find(
    (workflow) => workflow.changeTracker === session
  )
}

function documentHandle(
  id: string,
  workflow: () => ComfyWorkflow | undefined
): DocumentHandle {
  return Object.freeze({
    id,
    get isDeleted() {
      return !workflow()
    },
    get name() {
      return workflow()?.filename
    },
    get path() {
      const open = workflow()
      return open && !open.isTemporary ? open.path : undefined
    }
  })
}
