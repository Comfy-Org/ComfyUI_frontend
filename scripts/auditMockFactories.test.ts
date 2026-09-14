import { describe, expect, it } from 'vitest'

import { findUntypedMockFactories } from './auditMockFactories'

describe('findUntypedMockFactories', () => {
  it.for([
    ["vi.mock<unknown>(import('./app'), () => ({}))", './app'],
    ["vi.doMock<unknown>('./api', () => ({}))", './api'],
    ['vi.mock<unknown>(modulePath, () => ({}))', '<dynamic>']
  ])('reports %s', ([source, module]) => {
    expect(findUntypedMockFactories('example.test.ts', source)).toEqual([
      { file: 'example.test.ts', line: 1, endLine: 1, module }
    ])
  })

  it('finds nested multiline calls and ignores lookalikes', () => {
    const source = [
      '// vi.mock<unknown>(import("./comment"), () => ({}))',
      'const text = "vi.mock<unknown>(import(\'./string\'), () => ({}))"',
      'vi.mock(import("./typed"), () => ({}))',
      'vi.mock<object>(import("./other-type"), () => ({}))',
      'other.mock<unknown>(import("./other-object"), () => ({}))',
      'vi.fn<unknown>()',
      'function setup() {',
      '  vi.doMock<',
      '    unknown',
      '  >(',
      '    import("./nested"),',
      '    () => ({})',
      '  )',
      '}'
    ].join('\r\n')

    expect(findUntypedMockFactories('nested.test.ts', source)).toEqual([
      { file: 'nested.test.ts', line: 8, endLine: 13, module: './nested' }
    ])
  })
})
