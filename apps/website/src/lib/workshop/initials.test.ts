import { describe, expect, it } from 'vitest'

import { initialsOf, workspaceInitialsOf } from './initials'

describe('initialsOf', () => {
  it.for([
    ['Ada Lovelace', 'AL'],
    ['ada lovelace', 'AL'],
    ['Ada Workspace', 'AW'],
    ['Mariana Martinho Design', 'MM'],
    ['  spaced   out  ', 'SO'],
    ['solo', 'S'],
    ['', '']
  ] satisfies [string, string][])('reads %s as %s', ([name, expected]) => {
    expect(initialsOf(name)).toBe(expected)
  })
})

describe('workspaceInitialsOf', () => {
  it.for([
    ['Ada Studio', 'AS'],
    ['Personal Workspace', 'P'],
    ['personal workspace', 'P'],
    ['Ada Studio Workspace', 'AS'],
    ['Workspace', 'W'],
    ['Ada Workspace  ', 'A'],
    ['', '']
  ] satisfies [string, string][])('reads %s as %s', ([name, expected]) => {
    expect(workspaceInitialsOf(name)).toBe(expected)
  })
})
