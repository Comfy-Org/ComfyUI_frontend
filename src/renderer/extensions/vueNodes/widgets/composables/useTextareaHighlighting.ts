import { computed } from 'vue'
import type { Ref } from 'vue'

interface AstNode {
  type: 'root' | 'text' | 'line' | 'block'
  value?: string
  valid?: boolean
  children: AstNode[]
}

export function useTextareaHighlighting(
  textRef: Ref<string | undefined>,
  isEnabledRef: Ref<boolean>
) {
  return computed(() => {
    if (!isEnabledRef.value) return ''

    const text = textRef.value || ''
    const root: AstNode = { type: 'root', children: [] }
    let current: AstNode = root
    const parentStack: AstNode[] = []
    let currentText = ''

    function flushText() {
      if (currentText.length > 0) {
        current.children.push({
          type: 'text',
          value: currentText,
          children: []
        })
        currentText = ''
      }
    }

    let i = 0
    while (i < text.length) {
      // Line Comments (//)
      if (text.startsWith('//', i)) {
        flushText()
        const node: AstNode = { type: 'line', value: '//', children: [] }
        current.children.push(node)
        i += 2

        let lineText = ''
        while (i < text.length && text[i] !== '\n') {
          lineText += text[i]
          i++
        }
        if (lineText)
          node.children.push({ type: 'text', value: lineText, children: [] })
        continue
      }

      // Open Block Comment (/*)
      if (text.startsWith('/*', i)) {
        flushText()
        const node: AstNode = { type: 'block', valid: false, children: [] }
        current.children.push(node)
        parentStack.push(current)
        current = node

        current.children.push({ type: 'text', value: '/*', children: [] })
        i += 2
        continue
      }

      // Close Block Comment (*/)
      if (text.startsWith('*/', i)) {
        if (parentStack.length > 0) {
          flushText()
          current.children.push({ type: 'text', value: '*/', children: [] })
          current.valid = true
          current = parentStack.pop()!
          i += 2
          continue
        } else {
          // Unmatched closing bracket: treat everything from scope start as invalid block
          flushText()
          const node: AstNode = {
            type: 'block',
            valid: false,
            children: [...current.children]
          }
          node.children.push({ type: 'text', value: '*/', children: [] })
          current.children = [node]
          i += 2
          continue
        }
      }

      // Normal character
      currentText += text[i]
      i++
    }

    flushText()

    function escapeHtml(str: string) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    function render(node: AstNode): string {
      if (node.type === 'text') return escapeHtml(node.value || '')

      const innerHtml = node.children.map(render).join('')

      if (node.type === 'line') {
        return `<span class="text-green-500">${escapeHtml(node.value || '')}${innerHtml}</span>`
      }
      if (node.type === 'block') {
        const colorClass = node.valid ? 'text-green-500' : 'text-yellow-500'
        return `<span class="${colorClass}">${innerHtml}</span>`
      }
      if (node.type === 'root') {
        return innerHtml
      }
      return ''
    }

    let html = render(root)

    // Render extra line at the end
    if (text.endsWith('\n')) html += '<br/>'

    return html
  })
}
