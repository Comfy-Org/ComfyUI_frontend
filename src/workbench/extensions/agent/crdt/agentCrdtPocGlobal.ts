type AgentCrdtPocWindow = Window & {
  __agentCrdtPoc?: object
}

export function installAgentCrdtPocGlobal<T extends object>(
  value: T
): () => void {
  const pocWindow = window as AgentCrdtPocWindow
  pocWindow.__agentCrdtPoc = value

  return () => {
    if (pocWindow.__agentCrdtPoc === value) {
      delete pocWindow.__agentCrdtPoc
    }
  }
}
