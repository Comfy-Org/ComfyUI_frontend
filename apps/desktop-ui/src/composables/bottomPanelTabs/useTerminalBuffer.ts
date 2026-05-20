import { SerializeAddon } from '@xterm/addon-serialize'
import { Terminal } from '@xterm/xterm'
import { markRaw, onMounted, onUnmounted } from 'vue'

export function useTerminalBuffer() {
  const serializeAddon = new SerializeAddon()
  const terminal = markRaw(new Terminal({ convertEol: true }))

  function copyTo(destinationTerminal: Terminal) {
    destinationTerminal.write(serializeAddon.serialize())
  }

  function write(message: string) {
    return terminal.write(message)
  }

  function serialize() {
    return serializeAddon.serialize()
  }

  onMounted(() => {
    terminal.loadAddon(serializeAddon)
  })

  onUnmounted(() => {
    terminal.dispose()
  })

  return {
    copyTo,
    serialize,
    write
  }
}
