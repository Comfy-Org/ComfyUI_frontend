import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { debounce } from 'es-toolkit/compat'
import { Ref, markRaw, onMounted, onUnmounted } from 'vue'

export function useTerminal(element: Ref<HTMLElement | undefined>) {
  const fitAddon = new FitAddon()
  const terminal = markRaw(
    new Terminal({
      convertEol: true
    })
  )
  terminal.loadAddon(fitAddon)

  let currentSelection = ''
  let terminalHasFocus = false

  terminal.onSelectionChange(() => {
    currentSelection = terminal.getSelection()
  })

  // Don't use attachCustomKeyEventHandler as it might interfere with DOM events
  // We'll handle everything through DOM event listeners instead

  onMounted(async () => {
    if (element.value) {
      terminal.open(element.value)

      element.value.addEventListener('focusin', () => {
        terminalHasFocus = true
      })

      element.value.addEventListener('focusout', () => {
        terminalHasFocus = false
      })

      const handleKeyDown = (event: KeyboardEvent) => {
        if (!terminalHasFocus) {
          return
        }

        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
          if (currentSelection) {
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation()
            void navigator.clipboard.writeText(currentSelection)
            terminal.clearSelection()
            currentSelection = ''
            return false
          }
        }

        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          void navigator.clipboard.readText().then((text) => {
            if (text) {
              terminal.write(text)
            }
          })
          return false
        }
      }

      document.addEventListener('keydown', handleKeyDown, true)

      setTimeout(() => {
        const textarea = element.value?.querySelector(
          '.xterm-helper-textarea'
        ) as HTMLTextAreaElement
        if (textarea) {
          textarea.focus()
        }
      }, 100)
      ;(element.value as any)._terminalKeyHandler = handleKeyDown
    }
  })

  onUnmounted(() => {
    if (element.value && (element.value as any)._terminalKeyHandler) {
      const handler = (element.value as any)._terminalKeyHandler
      document.removeEventListener('keydown', handler, true)
      delete (element.value as any)._terminalKeyHandler
    }

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
      root: Ref<HTMLElement | undefined>
      autoRows?: boolean
      autoCols?: boolean
      minCols?: number
      minRows?: number
      onResize?: () => void
    }) {
      const ensureValidRows = (rows: number | undefined): number => {
        if (rows == null || isNaN(rows)) {
          return (root.value?.clientHeight ?? 80) / 20
        }
        return rows
      }

      const ensureValidCols = (cols: number | undefined): number => {
        if (cols == null || isNaN(cols)) {
          // Sometimes this is NaN if so, estimate.
          return (root.value?.clientWidth ?? 80) / 8
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
        if (root.value) {
          resizeObserver.observe(root.value)
          resize()
        }
      })

      onUnmounted(() => {
        resizeObserver.disconnect()
      })

      return { resize }
    }
  }
}
