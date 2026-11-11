export type KeybindingGate = (commandId: string) => boolean

const gates: KeybindingGate[] = []

export function registerKeybindingGate(gate: KeybindingGate): () => void {
  gates.push(gate)
  return () => {
    const index = gates.indexOf(gate)
    if (index !== -1) gates.splice(index, 1)
  }
}

export function isKeybindingAllowed(commandId: string): boolean {
  return gates.every((gate) => gate(commandId))
}

export function clearKeybindingGates(): void {
  gates.length = 0
}
