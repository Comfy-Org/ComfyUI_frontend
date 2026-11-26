import { createUuidv4 } from '@/utils/uuid'

let clientSessionId: string | undefined

/** An opaque id for this page load. */
export function agentClientSessionId(): string {
  clientSessionId ??= createUuidv4()
  return clientSessionId
}
