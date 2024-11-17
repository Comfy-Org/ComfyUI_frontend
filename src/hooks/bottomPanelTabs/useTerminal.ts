import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { debounce } from 'lodash'
import { onMounted, onUnmounted, Ref } from 'vue'
import '@xterm/xterm/css/xterm.css'

export function useTerminal(element: Ref<HTMLElement>) {
  const fitAddon = new FitAddon()
  const terminal = new Terminal({
    convertEol: true
  })
  terminal.loadAddon(fitAddon)

  onMounted(async () => {
    terminal.open(element.value)
  })

  onUnmounted(() => {
    terminal.dispose()
  })

  return {
    terminal,
    useAutoSize(
      root: Ref<HTMLElement>,
      autoRows: boolean = true,
      autoCols: boolean = true,
      onResize?: () => void
    ) {
      const ensureValidRows = (rows: number | undefined) => {
        if (rows == null || isNaN(rows)) {
          return root.value?.clientHeight / 20
        }
        return rows
      }

      const ensureValidCols = (cols: number | undefined): number => {
        if (cols == null || isNaN(cols)) {
          // Sometimes this is NaN if so, estimate.
          return root.value?.clientWidth / 8
        }
        return cols
      }

      const resize = () => {
        const dims = fitAddon.proposeDimensions()
        // Sometimes propose returns NaN, so we may need to estimate.
        terminal.resize(
          autoCols ? ensureValidCols(dims?.cols) : terminal.cols,
          autoRows ? ensureValidRows(dims?.rows) : terminal.rows
        )
        onResize?.()
      }

      const resizeObserver = new ResizeObserver(debounce(resize, 25))

      onMounted(async () => {
        resizeObserver.observe(root.value)
        resize()
      })

      onUnmounted(() => {
        resizeObserver.disconnect()
      })

      return { resize }
    }
  }
}
