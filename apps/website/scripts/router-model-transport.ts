import { Agent, getGlobalDispatcher, setGlobalDispatcher } from 'undici'

export function openRouterModelTransport(
  timeoutMs: number
): () => Promise<void> {
  const previous = getGlobalDispatcher()
  const agent = new Agent({ headersTimeout: timeoutMs, bodyTimeout: timeoutMs })
  setGlobalDispatcher(agent)
  return async function close() {
    setGlobalDispatcher(previous)
    await agent.close()
  }
}
