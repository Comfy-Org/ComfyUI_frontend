import { app } from '../../scripts/app'

type Enclosure = {
  start: number
  end: number
}

export function incrementWeight(weight: string, delta: number): string {
  const floatWeight = parseFloat(weight)
  if (isNaN(floatWeight)) return weight
  const newWeight = floatWeight + delta
  return String(Number(newWeight.toFixed(10)))
}

export function findNearestEnclosure(
  text: string,
  cursorPos: number
): Enclosure | null {
  let start = cursorPos
  let end = cursorPos
  let openCount = 0
  let closeCount = 0

  if (text[cursorPos] === '(') {
    end = cursorPos + 1
  } else {
    while (start >= 0) {
      start--
      if (text[start] === '(' && openCount === closeCount) break
      if (text[start] === '(') openCount++
      if (text[start] === ')') closeCount++
    }
    if (start < 0) return null
    openCount = 0
    closeCount = 0
  }

  while (end < text.length) {
    if (text[end] === ')' && openCount === closeCount) break
    if (text[end] === '(') openCount++
    if (text[end] === ')') closeCount++
    end++
  }
  if (end === text.length) return null

  return { start: start + 1, end: end }
}

export function addWeightToParentheses(text: string): string {
  const parenMatch = text.match(/^\((.*)\)$/)
  if (!parenMatch) return text
  const innerText = parenMatch[1]
  // A time-like pattern (e.g. "12:30") is preceded by whitespace or string-start;
  // everything else ending in ":number" is a weight, including digit-ending names like "v2:1.5".
  const looksLikeTime = /(?:^|\s)\d{1,2}:\d{2}$/.test(innerText)
  const hasTrailingWeight =
    !looksLikeTime && /:[+-]?(?:\d*\.)?\d+(?:[eE][+-]?\d+)?$/.test(innerText)
  return hasTrailingWeight ? text : `(${innerText}:1.0)`
}

app.registerExtension({
  name: 'Comfy.EditAttention',
  init() {
    const editAttentionDelta = app.ui.settings.addSetting({
      id: 'Comfy.EditAttention.Delta',
      category: ['Comfy', 'EditTokenWeight', 'Delta'],
      name: 'Ctrl+up/down precision',
      type: 'slider',
      attrs: {
        min: 0.01,
        max: 0.5,
        step: 0.01
      },
      defaultValue: 0.05
    })

    function editAttention(event: KeyboardEvent) {
      // @ts-expect-error Runtime narrowing not impl.
      const inputField: HTMLTextAreaElement = event.composedPath()[0]
      const delta = parseFloat(editAttentionDelta.value)

      if (inputField.tagName !== 'TEXTAREA') return
      if (!(event.key === 'ArrowUp' || event.key === 'ArrowDown')) return
      if (!event.ctrlKey && !event.metaKey) return

      event.preventDefault()

      let start = inputField.selectionStart
      let end = inputField.selectionEnd
      let selectedText = inputField.value.substring(start, end)

      if (!selectedText) {
        const nearestEnclosure = findNearestEnclosure(inputField.value, start)
        if (nearestEnclosure) {
          start = nearestEnclosure.start
          end = nearestEnclosure.end
          selectedText = inputField.value.substring(start, end)
        } else {
          const delimiters = ' .,\\/!?%^*;:{}=-_`~()\r\n\t'

          while (
            !delimiters.includes(inputField.value[start - 1]) &&
            start > 0
          ) {
            start--
          }

          while (
            !delimiters.includes(inputField.value[end]) &&
            end < inputField.value.length
          ) {
            end++
          }

          selectedText = inputField.value.substring(start, end)
          if (!selectedText) return
        }
      }

      const selectionEndsWithSpace =
        selectedText[selectedText.length - 1] === ' '
      if (selectionEndsWithSpace) {
        selectedText = selectedText.substring(0, selectedText.length - 1)
        end -= 1
      }

      const selectionIsSurroundedByParens =
        inputField.value[start - 1] === '(' && inputField.value[end] === ')'
      if (selectionIsSurroundedByParens) {
        start -= 1
        end += 1
        selectedText = inputField.value.substring(start, end)
      }

      const selectionIsNotEnclosedInParens =
        selectedText[0] !== '(' || selectedText[selectedText.length - 1] !== ')'
      if (selectionIsNotEnclosedInParens) selectedText = `(${selectedText})`

      selectedText = addWeightToParentheses(selectedText)

      const weightDelta = event.key === 'ArrowUp' ? delta : -delta
      const updatedText = selectedText.replace(
        /\((.*):([+-]?(?:\d*\.)?\d+(?:[eE][+-]?\d+)?)\)/,
        (_, text, weight) => {
          weight = incrementWeight(weight, weightDelta)
          if (weight == 1) {
            return text
          } else {
            return `(${text}:${weight})`
          }
        }
      )

      inputField.setSelectionRange(start, end)
      // Intentional use of deprecated: https://developer.mozilla.org/docs/Web/API/Document/execCommand#using_inserttext
      document.execCommand('insertText', false, updatedText)
      inputField.setSelectionRange(start, start + updatedText.length)
    }
    window.addEventListener('keydown', editAttention)
  }
})
