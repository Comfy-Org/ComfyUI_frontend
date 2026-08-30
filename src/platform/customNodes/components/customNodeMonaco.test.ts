import { describe, expect, it } from 'vitest'

import { languageForCustomNodePath } from './customNodeMonaco'

describe('languageForCustomNodePath', () => {
  it('uses Monaco language IDs for custom node source files', () => {
    expect(languageForCustomNodePath('v2/nodes/checkerboard.py')).toBe('python')
    expect(languageForCustomNodePath('v2/web/js/checkerboard.mjs')).toBe(
      'javascript'
    )
    expect(languageForCustomNodePath('README.md')).toBe('markdown')
    expect(languageForCustomNodePath('v2/pyproject.toml')).toBe('ini')
    expect(languageForCustomNodePath('config.yml')).toBe('yaml')
  })
})
