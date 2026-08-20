import type { DocOp, DocUpdate } from './docFrameClient'
import type { DocFrameClient } from './docFrameClient'
import { FollowerDoc } from './followerDoc'

interface RemoteLayoutStore {
  applyUpdate(update: Uint8Array): void
}

export class LayoutFollowerBridge extends EventTarget {
  readonly follower = new FollowerDoc()
  private workflowId: string | null = null

  constructor(
    private readonly client: DocFrameClient,
    private readonly layoutStore: RemoteLayoutStore
  ) {
    super()
    client.addEventListener('doc_update', this.onDocUpdate)
    client.addEventListener('doc_subscribed', this.forwardFrame)
    client.addEventListener('doc_ops_result', this.forwardFrame)
  }

  subscribe(workflowId: string): void {
    if (this.workflowId === workflowId) return
    if (this.workflowId !== null) this.client.unsubscribe(this.workflowId)
    this.workflowId = workflowId
    this.client.subscribe(workflowId, this.follower.stateVector())
  }

  resubscribe(): void {
    if (this.workflowId !== null)
      this.client.subscribe(this.workflowId, this.follower.stateVector())
  }

  unsubscribe(): void {
    if (this.workflowId !== null) this.client.unsubscribe(this.workflowId)
    this.workflowId = null
  }

  sendHumanOps(tab: string, ops: DocOp[]): void {
    if (this.workflowId === null || ops.length === 0) return
    this.client.sendOps(this.workflowId, tab, ops)
  }

  destroy(): void {
    this.unsubscribe()
    this.client.removeEventListener('doc_update', this.onDocUpdate)
    this.client.removeEventListener('doc_subscribed', this.forwardFrame)
    this.client.removeEventListener('doc_ops_result', this.forwardFrame)
    this.follower.destroy()
  }

  private readonly onDocUpdate: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const update = event.detail as DocUpdate
    if (update.workflowId !== this.workflowId) return
    this.follower.applyRemoteUpdate(update.update)
    this.layoutStore.applyUpdate(update.update)
    this.dispatchEvent(new CustomEvent('doc_update', { detail: update }))
  }

  private readonly forwardFrame: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    this.dispatchEvent(new CustomEvent(event.type, { detail: event.detail }))
  }
}
