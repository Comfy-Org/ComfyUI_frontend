import { describe, expect, it } from 'vitest'

import { initialsOf } from './initials'

describe('initialsOf', () => {
  it.for([
    ['Ada Studio', 'AS'],
    ['Personal Workspace', 'P'],
    ['personal workspace', 'P'],
    ['Ada Studio Workspace', 'AS'],
    ['Workspace', 'W'],
    ['Mariana Martinho Design', 'MM'],
    ['  spaced   out  ', 'SO'],
    ['solo', 'S'],
    ['', '']
  ] satisfies [string, string][])('reads %s as %s', ([name, expected]) => {
    expect(initialsOf(name)).toBe(expected)
  })
})
