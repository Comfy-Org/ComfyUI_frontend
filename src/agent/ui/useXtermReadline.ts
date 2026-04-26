import type { Terminal } from '@xterm/xterm'
import { ref } from 'vue'

import type { Completion } from '../shell/useCompletion'
import { getCompletions } from '../shell/useCompletion'

const PROMPT = '\x1b[36mcomfy>\x1b[0m '
const HISTORY_KEY = 'Comfy.Agent.Xterm.History'
const HISTORY_MAX = 100

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string') : []
  } catch {
    return []
  }
}

function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(-HISTORY_MAX))
    )
  } catch {
    /* noop */
  }
}

interface ReadlineOptions {
  onSubmit: (line: string) => void | Promise<void>
  prompt?: string
}

export function useXtermReadline(terminal: Terminal, options: ReadlineOptions) {
  const prompt = options.prompt ?? PROMPT
  let buffer = ''
  let cursor = 0
  // Track the cursor row offset from the start of the current prompt.
  // 0 = same row as prompt; 1 = one row below; etc. Used to correctly
  // clear multi-row wrapped input when redrawing.
  let termCursorRow = 0
  const history = ref<string[]>(loadHistory())
  let historyIdx = history.value.length
  const completions = ref<Completion[]>([])
  let completionIdx = 0

  // eslint-disable-next-line no-control-regex -- stripping ANSI SGR codes
  const PROMPT_VISIBLE_LEN = prompt.replace(/\x1b\[[0-9;]*m/g, '').length

  function cols(): number {
    return terminal.cols || 80
  }

  function showPrompt(): void {
    terminal.write(prompt)
    termCursorRow = 0
  }

  function redrawLine(): void {
    const c = cols()
    // Move up to prompt row, then clear everything from there down.
    if (termCursorRow > 0) terminal.write(`\x1b[${termCursorRow}A`)
    terminal.write('\r\x1b[J')

    // Re-write the prompt + buffer. \n in the buffer (from Shift+Enter)
    // should become a visual continuation.
    const display = buffer.replace(/\n/g, '\r\n\x1b[90m> \x1b[0m')
    terminal.write(prompt + display)

    // Compute where xterm's cursor is now: at the end of (prompt + display).
    // For cursor positioning, we need the logical cursor offset in the
    // pre-transform buffer. Count wraps + explicit newlines.
    const endRow = visualRowOf(buffer.length)
    const curRow = visualRowOf(cursor)
    const endCol = visualColOf(buffer.length)
    const curCol = visualColOf(cursor)

    if (endRow > curRow) terminal.write(`\x1b[${endRow - curRow}A`)
    if (endCol > curCol) terminal.write(`\x1b[${endCol - curCol}D`)
    else if (endCol < curCol) terminal.write(`\x1b[${curCol - endCol}C`)

    termCursorRow = curRow

    // Also: if the wrapped content pushed the viewport past the bottom,
    // xterm scrolled and our row math may be off. Cheap mitigation: cap.
    // (Not implemented — practically rare for our panel height.)
    void c
  }

  /** Visual row (0-based, relative to prompt start) of the Nth char in buffer. */
  function visualRowOf(n: number): number {
    const c = cols()
    let row = 0
    let col = PROMPT_VISIBLE_LEN
    for (let i = 0; i < n; i++) {
      const ch = buffer[i]
      if (ch === '\n') {
        row++
        col = 2 // '> ' continuation
      } else {
        col++
        if (col >= c) {
          row++
          col = 0
        }
      }
    }
    return row
  }

  function visualColOf(n: number): number {
    const c = cols()
    let col = PROMPT_VISIBLE_LEN
    for (let i = 0; i < n; i++) {
      const ch = buffer[i]
      if (ch === '\n') {
        col = 2
      } else {
        col++
        if (col >= c) col = 0
      }
    }
    return col
  }

  function insertAtCursor(text: string): void {
    const before = buffer.slice(0, cursor)
    const after = buffer.slice(cursor)
    buffer = before + text + after
    cursor += text.length
    redrawLine()
  }

  /** Insert a literal newline into the buffer. Does not submit. */
  function insertNewline(): void {
    buffer = buffer.slice(0, cursor) + '\n' + buffer.slice(cursor)
    cursor++
    redrawLine()
  }

  function backspace(): void {
    if (cursor === 0) return
    buffer = buffer.slice(0, cursor - 1) + buffer.slice(cursor)
    cursor--
    redrawLine()
  }

  function deleteForward(): void {
    if (cursor >= buffer.length) return
    buffer = buffer.slice(0, cursor) + buffer.slice(cursor + 1)
    redrawLine()
  }

  function moveLeft(): void {
    if (cursor > 0) {
      cursor--
      redrawLine()
    }
  }

  function moveRight(): void {
    if (cursor < buffer.length) {
      cursor++
      redrawLine()
    }
  }

  function moveHome(): void {
    if (cursor > 0) {
      cursor = 0
      redrawLine()
    }
  }

  function moveEnd(): void {
    if (cursor < buffer.length) {
      cursor = buffer.length
      redrawLine()
    }
  }

  function clearLine(): void {
    buffer = ''
    cursor = 0
    redrawLine()
  }

  function recallHistory(offset: number): void {
    const newIdx = historyIdx + offset
    if (newIdx < 0 || newIdx > history.value.length) return
    historyIdx = newIdx
    buffer = history.value[historyIdx] ?? ''
    cursor = buffer.length
    redrawLine()
  }

  function completeTab(): void {
    // cycle through completions if we already have some
    if (completions.value.length > 0) {
      completionIdx = (completionIdx + 1) % completions.value.length
    } else {
      const res = getCompletions(buffer)
      completions.value = res.completions
      completionIdx = 0
      if (completions.value.length === 0) return
    }
    const chosen = completions.value[completionIdx]
    if (!chosen) return
    // replace the last token
    const res = getCompletions(buffer)
    const newBuf = buffer.slice(0, res.replaceFrom) + chosen.value
    buffer = newBuf
    cursor = buffer.length
    redrawLine()
  }

  function resetCompletion(): void {
    completions.value = []
    completionIdx = 0
  }

  function submit(): void {
    const line = buffer
    // Move cursor to the end of the (multi-row) display before CRLF so
    // subsequent output starts on its own row instead of on top of us.
    cursor = buffer.length
    redrawLine()
    terminal.write('\r\n')
    termCursorRow = 0
    if (line.trim()) {
      history.value.push(line)
      if (history.value.length > HISTORY_MAX) {
        history.value = history.value.slice(-HISTORY_MAX)
      }
      saveHistory(history.value)
    }
    historyIdx = history.value.length
    buffer = ''
    cursor = 0
    resetCompletion()
    void options.onSubmit(line)
  }

  const dataDisposable = terminal.onData((data) => {
    // Special sequences
    if (data === '\r' || data === '\n') {
      submit()
      return
    }
    if (data === '\x7f') {
      // backspace
      resetCompletion()
      backspace()
      return
    }
    if (data === '\x04' || data === '\x1b[3~') {
      // \x04 = Ctrl+D (EOT), \x1b[3~ = actual Delete key
      resetCompletion()
      deleteForward()
      return
    }
    if (data === '\x01') {
      moveHome()
      return
    }
    if (data === '\x05') {
      moveEnd()
      return
    }
    if (data === '\x0b') {
      // Ctrl+K: kill to end of line
      buffer = buffer.slice(0, cursor)
      redrawLine()
      return
    }
    if (data === '\x15') {
      // Ctrl+U: kill whole line
      clearLine()
      return
    }
    if (data === '\x0c') {
      // Ctrl+L: clear screen
      terminal.clear()
      showPrompt()
      terminal.write(buffer)
      return
    }
    if (data === '\x03') {
      // Ctrl+C: abort line
      terminal.write('^C\r\n')
      clearLine()
      showPrompt()
      return
    }
    if (data === '\t') {
      completeTab()
      return
    }
    // Arrow keys
    if (data === '\x1b[A') {
      resetCompletion()
      recallHistory(-1)
      return
    }
    if (data === '\x1b[B') {
      resetCompletion()
      recallHistory(1)
      return
    }
    if (data === '\x1b[C') {
      moveRight()
      return
    }
    if (data === '\x1b[D') {
      moveLeft()
      return
    }
    if (data === '\x1b[H') {
      moveHome()
      return
    }
    if (data === '\x1b[F') {
      moveEnd()
      return
    }
    // Plain printable
    if (data >= ' ' || data === '\t') {
      resetCompletion()
      insertAtCursor(data)
    }
  })

  return {
    showPrompt,
    /** Programmatically insert text at the cursor (e.g. from a drop). */
    paste(text: string): void {
      insertAtCursor(text)
    },
    /** Insert a literal newline (for Shift+Enter / multiline input). */
    newline(): void {
      resetCompletion()
      insertNewline()
    },
    dispose(): void {
      dataDisposable.dispose()
    }
  }
}
