import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { debounce } from 'lodash'
import { Ref, markRaw, onMounted, onUnmounted } from 'vue'

export function useTerminal(element: Ref<HTMLElement>) {
  const fitAddon = new FitAddon()
  const terminal = markRaw(
    new Terminal({
      convertEol: true
    })
  )
  terminal.loadAddon(fitAddon)

  terminal.attachCustomKeyEventHandler((event) => {
    // Allow default browser copy/paste handling
    if (
      event.type === 'keydown' &&
      (event.ctrlKey || event.metaKey) &&
      ((event.key === 'c' && terminal.hasSelection()) || event.key === 'v')
    ) {
      // TODO: Deselect text after copy/paste; use IPC.
      return false
    }
    return true
  })

  onMounted(async () => {
    terminal.open(element.value)
  })

  onUnmounted(() => {
    terminal.dispose()
  })

  return {
    terminal,
    useAutoSize({
      root,
      autoRows = true,
      autoCols = true,
      minCols = Number.NEGATIVE_INFINITY,
      minRows = Number.NEGATIVE_INFINITY,
      onResize
    }: {
      root: Ref<HTMLElement>
      autoRows?: boolean
      autoCols?: boolean
      minCols?: number
      minRows?: number
      onResize?: () => void
    }) {
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
          Math.max(
            autoCols ? ensureValidCols(dims?.cols) : terminal.cols,
            minCols
          ),
          Math.max(
            autoRows ? ensureValidRows(dims?.rows) : terminal.rows,
            minRows
          )
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
