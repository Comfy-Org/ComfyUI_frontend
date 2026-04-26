import { describe, expect, it } from 'vitest'

import { parseScript } from './parser'

describe('parseScript', () => {
  it('parses single command', () => {
    expect(parseScript('echo hi')).toEqual({
      type: 'simple',
      cmd: { argv: ['echo', 'hi'], redirect: undefined }
    })
  })

  it('parses quoted arguments', () => {
    const node = parseScript('echo "hello world"')
    expect(node).toMatchObject({
      type: 'simple',
      cmd: { argv: ['echo', 'hello world'] }
    })
  })

  it('parses pipes', () => {
    const node = parseScript('a | b | c')
    expect(node.type).toBe('pipe')
    if (node.type === 'pipe') {
      expect(node.cmds.map((c) => c.argv[0])).toEqual(['a', 'b', 'c'])
    }
  })

  it('parses seq ;', () => {
    const node = parseScript('a ; b')
    expect(node.type).toBe('seq')
  })

  it('parses && as and', () => {
    const node = parseScript('a && b')
    expect(node.type).toBe('and')
  })

  it('parses || as or', () => {
    const node = parseScript('a || b')
    expect(node.type).toBe('or')
  })

  it('precedence: pipe binds tightest, then and/or, then seq', () => {
    const node = parseScript('a && b | c || d ; e')
    expect(node.type).toBe('seq')
    if (node.type !== 'seq') return
    expect(node.right).toMatchObject({
      type: 'simple',
      cmd: { argv: ['e'] }
    })
    expect(node.left.type).toBe('or')
  })

  it('parses > redirect on simple cmd', () => {
    const node = parseScript('echo hi > /tmp/x')
    expect(node).toMatchObject({
      type: 'simple',
      cmd: { argv: ['echo', 'hi'], redirect: { op: '>', path: '/tmp/x' } }
    })
  })

  it('parses >> redirect', () => {
    const node = parseScript('echo hi >> /tmp/x')
    if (node.type !== 'simple') throw new Error('expected simple')
    expect(node.cmd.redirect).toEqual({ op: '>>', path: '/tmp/x' })
  })

  it('lifts pipe final redirect to pipe node', () => {
    const node = parseScript('a | b > /tmp/x')
    expect(node.type).toBe('pipe')
    if (node.type !== 'pipe') return
    expect(node.redirect).toEqual({ op: '>', path: '/tmp/x' })
    expect(node.cmds[1].redirect).toBeUndefined()
  })

  it('expands $VAR from env', () => {
    const node = parseScript('echo $FOO', { FOO: 'bar' })
    expect(node).toMatchObject({
      type: 'simple',
      cmd: { argv: ['echo', 'bar'] }
    })
  })

  it('throws on command substitution $(...)', () => {
    expect(() => parseScript('echo $(ls)')).toThrow()
  })

  it('throws on glob', () => {
    expect(() => parseScript('echo *.txt')).toThrow(/glob/)
  })

  it('throws on background &', () => {
    expect(() => parseScript('sleep 1 &')).toThrow()
  })
})
