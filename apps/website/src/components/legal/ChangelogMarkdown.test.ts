import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ChangelogMarkdown from './ChangelogMarkdown'

describe('ChangelogMarkdown', () => {
  it.for([
    [
      'an https link',
      '[Docs](https://docs.comfy.org)',
      '<p><a href="https://docs.comfy.org/">Docs</a></p>'
    ],
    ['an http link', '[Old](http://example.com)', '<p>Old</p>'],
    ['an upper-case javascript: link', '[X](JAVASCRIPT:alert(1))', '<p>X</p>'],
    ['a credentialed link', '[X](https://user:pass@example.com)', '<p>X</p>'],
    [
      'a tab-smuggled https link',
      '<a href="https://docs.comfy.org/\tx">T</a>',
      '<p>T</p>'
    ],
    ['a relative link', '[Install](/installation)', '<p>Install</p>'],
    [
      'inline event and style attributes',
      '<p onclick="alert(1)" style="color:red">Hi</p>',
      '<p>Hi</p>'
    ],
    ['an image with onerror', '<img src="x" onerror="alert(1)">', ''],
    ['a style block', '<style>body{display:none}</style>', ''],
    ['a script block', '<script>window.bad = true</script>', '']
  ] as const)('renders %s as allowlisted markup', ([, markdown, html]) => {
    const { html: rendered } = render(ChangelogMarkdown, {
      props: { markdown }
    })
    expect(rendered().replace(/\n\s*/g, '')).toBe(`<div>${html}</div>`)
  })
})
