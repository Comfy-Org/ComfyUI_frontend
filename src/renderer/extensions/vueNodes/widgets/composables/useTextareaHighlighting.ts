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
      let nextIndex = -1
      let nextToken = ''

      if (current.type === 'block') {
        nextIndex = text.indexOf('*/', i)
        if (nextIndex === -1) {
          currentText += text.slice(i)
          break
        }
        nextToken = '*/'
      } else {
        const lineCommentIdx = text.indexOf('//', i)
        const blockCommentIdx = text.indexOf('/*', i)
        const closeBlockIdx = text.indexOf('*/', i)

        const indices = [
          { token: '//', idx: lineCommentIdx },
          { token: '/*', idx: blockCommentIdx },
          { token: '*/', idx: closeBlockIdx }
        ]
          .filter((x) => x.idx !== -1)
          .sort((a, b) => a.idx - b.idx)

        if (indices.length > 0) {
          nextIndex = indices[0].idx
          nextToken = indices[0].token
        } else {
          currentText += text.slice(i)
          break
        }
      }

      if (nextIndex > i) {
        currentText += text.slice(i, nextIndex)
        i = nextIndex
      }

      if (nextToken === '//') {
        flushText()
        const node: AstNode = { type: 'line', value: '//', children: [] }
        current.children.push(node)
        i += 2

        const endIdx = text.indexOf('\n', i)
        if (endIdx !== -1) {
          const lineText = text.slice(i, endIdx)
          if (lineText)
            node.children.push({ type: 'text', value: lineText, children: [] })
          i = endIdx
        } else {
          const lineText = text.slice(i)
          if (lineText)
            node.children.push({ type: 'text', value: lineText, children: [] })
          break
        }
        continue
      }

      if (nextToken === '/*') {
        flushText()
        const node: AstNode = { type: 'block', valid: false, children: [] }
        current.children.push(node)
        parentStack.push(current)
        current = node

        current.children.push({ type: 'text', value: '/*', children: [] })
        i += 2
        continue
      }

      if (nextToken === '*/') {
        flushText()
        if (parentStack.length > 0) {
          current.children.push({ type: 'text', value: '*/', children: [] })
          current.valid = true
          current = parentStack.pop()!
        } else {
          const node: AstNode = {
            type: 'block',
            valid: false,
            children: [{ type: 'text', value: '*/', children: [] }]
          }
          current.children.push(node)
        }
        i += 2
        continue
      }
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
