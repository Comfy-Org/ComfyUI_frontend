import { createUuidv4 } from '@comfyorg/graph-model/uuid'

let clientSessionId: string | undefined

/** An opaque id for this page load. */
export function agentClientSessionId(): string {
  clientSessionId ??= createUuidv4()
  return clientSessionId
}
