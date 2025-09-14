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
    console.error('Selection changed:', currentSelection)
  })

  // Don't use attachCustomKeyEventHandler as it might interfere with DOM events
  // We'll handle everything through DOM event listeners instead

  onMounted(async () => {
    if (element.value) {
      terminal.open(element.value)

      element.value.addEventListener('focusin', () => {
        terminalHasFocus = true
        console.error('Terminal gained focus')
      })

      element.value.addEventListener('focusout', () => {
        terminalHasFocus = false
        console.error('Terminal lost focus')
      })

      const handleKeyDown = (event: KeyboardEvent) => {
        console.error(
          'Global key event:',
          event.key,
          'target:',
          event.target,
          'terminal has focus:',
          terminalHasFocus
        )

        if (!terminalHasFocus) {
          return
        }

        console.error(
          'Processing terminal key:',
          event.key,
          'ctrl:',
          event.ctrlKey,
          'meta:',
          event.metaKey
        )

        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
          console.error('Copy shortcut!', currentSelection)
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
          console.error('Paste shortcut!')
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          void navigator.clipboard.readText().then((text) => {
            console.error('Pasting:', text)
            if (text) {
              terminal.write(text)
            }
          })
          return false
        }
      }

      console.error('Attaching keyboard listener to document')
      document.addEventListener('keydown', handleKeyDown, true)

      setTimeout(() => {
        const textarea = element.value?.querySelector(
          '.xterm-helper-textarea'
        ) as HTMLTextAreaElement
        if (textarea) {
          console.error('Found xterm textarea, focusing it')
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
