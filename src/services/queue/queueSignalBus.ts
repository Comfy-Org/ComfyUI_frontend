export type QueueQueueingSignal = {
  requestId: number
  batchCount: number
  number?: number
}

export type QueueQueuedSignal = {
  requestId?: number
  batchCount: number
  number?: number
}

interface QueueSignalPayloads {
  queueing: QueueQueueingSignal
  queued: QueueQueuedSignal
}

class QueueSignalBus extends EventTarget {
  on<TEvent extends keyof QueueSignalPayloads>(
    type: TEvent,
    callback:
      | ((event: CustomEvent<QueueSignalPayloads[TEvent]>) => void)
      | null,
    options?: AddEventListenerOptions | boolean
  ): void {
    super.addEventListener(type, callback as EventListener, options)
  }

  off<TEvent extends keyof QueueSignalPayloads>(
    type: TEvent,
    callback:
      | ((event: CustomEvent<QueueSignalPayloads[TEvent]>) => void)
      | null,
    options?: EventListenerOptions | boolean
  ): void {
    super.removeEventListener(type, callback as EventListener, options)
  }

  emit<TEvent extends keyof QueueSignalPayloads>(
    type: TEvent,
    detail: QueueSignalPayloads[TEvent]
  ): boolean {
    return super.dispatchEvent(new CustomEvent(type, { detail }))
  }

  /** @deprecated Use {@link emit}. */
  override dispatchEvent(event: never): boolean {
    return super.dispatchEvent(event)
  }
}

export const queueSignalBus = new QueueSignalBus()
