import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useTextareaHighlighting } from './useTextareaHighlighting'

describe('useTextareaHighlighting', () => {
  // Standard cases
  it('handles empty block comments', () => {
    const textRef = ref('/**/')
    const isEnabledRef = ref(true)
    const highlighted = useTextareaHighlighting(textRef, isEnabledRef)

    expect(highlighted.value).toContain(
      '<span class="text-green-500">/**/</span>'
    )
  })

  it('handles multiline block comments', () => {
    const textRef = ref('/**\n * docs\n */')
    const isEnabledRef = ref(true)
    const highlighted = useTextareaHighlighting(textRef, isEnabledRef)

    expect(highlighted.value).toContain(
      '<span class="text-green-500">/**\n * docs\n */</span>'
    )
  })

  it('ignores block comment inside line comments', () => {
    const textRef = ref('// this is a /* comment */')
    const isEnabledRef = ref(true)
    const highlighted = useTextareaHighlighting(textRef, isEnabledRef)

    // The entire line should be treated as a single line comment
    expect(highlighted.value).toContain(
      '<span class="text-green-500">// this is a /* comment */</span>'
    )
  })

  it('ignores line comment inside block comments', () => {
    const textRef = ref('/* // skipped */')
    const isEnabledRef = ref(true)
    const highlighted = useTextareaHighlighting(textRef, isEnabledRef)

    expect(highlighted.value).toContain(
      '<span class="text-green-500">/* // skipped */</span>'
    )
  })

  it('handles consecutive slashes', () => {
    const textRef = ref('/// <reference types="vite/client" />')
    const isEnabledRef = ref(true)
    const highlighted = useTextareaHighlighting(textRef, isEnabledRef)

    expect(highlighted.value).toContain(
      '<span class="text-green-500">/// &lt;reference types="vite/client" /&gt;</span>'
    )
  })

  it('handles stray block comment closures', () => {
    const textRef = ref('some text */ more text')
    const isEnabledRef = ref(true)
    const highlighted = useTextareaHighlighting(textRef, isEnabledRef)

    expect(highlighted.value).toContain(
      '<span class="text-yellow-500">*/</span>'
    )
  })

  // Ignore standard JS string contexts
  it('intentionally highlights URLs inside strings as line comments', () => {
    const textRef = ref('const url = "https://example.com";')
    const isEnabledRef = ref(true)
    const highlighted = useTextareaHighlighting(textRef, isEnabledRef)

    expect(highlighted.value).toContain(
      '<span class="text-green-500">//example.com";</span>'
    )
  })

  it('intentionally highlights block comments inside strings', () => {
    const textRef = ref('const str = "/* not a JS comment */";')
    const isEnabledRef = ref(true)
    const highlighted = useTextareaHighlighting(textRef, isEnabledRef)

    expect(highlighted.value).toContain(
      '<span class="text-green-500">/* not a JS comment */</span>'
    )
  })
})
