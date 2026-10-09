import { describe, expect, it } from 'vitest'

import {
  expiredTickets,
  extractTickets,
  indexIssueStates
} from './pendingServerFacts'

describe('extractTickets', () => {
  it.for([
    ["pendingServerFact('BE-12', x)", 'single quotes'],
    ['pendingServerFact("BE-12", x)', 'double quotes'],
    ['pendingServerFact(`BE-12`, x)', 'a substitution-free template'],
    ['pendingServerFact(\n  "BE-12",\n  x\n)', 'newlines inside the call'],
    ['pendingServerFact ( "BE-12" , x)', 'spaces around the literal']
  ])('finds the ticket in %s (%s)', ([source]) => {
    expect(extractTickets(source)).toEqual([{ line: 1, ticket: 'BE-12' }])
  })

  it('reports every call with the line it starts on', () => {
    const source = [
      "const a = pendingServerFact('BE-1', 1)",
      '',
      'const b = pendingServerFact(',
      "  'BE-2',",
      '  2',
      ')'
    ].join('\n')

    expect(extractTickets(source)).toEqual([
      { line: 1, ticket: 'BE-1' },
      { line: 3, ticket: 'BE-2' }
    ])
  })

  it.for([
    ['pendingServerFact(ticket, x)', 'a variable'],
    ['pendingServerFact(`BE-${n}`, x)', 'a template with a substitution'],
    ["pendingServerFact('FE-12', x)", 'a non-backend ticket']
  ])('flags %s as a non-literal ticket (%s)', ([source]) => {
    expect(extractTickets(source)).toEqual([{ line: 1, ticket: null }])
  })

  it('ignores imports and the declaration', () => {
    const source = [
      "import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'",
      'export function pendingServerFact<T>(_ticket: BackendTicket, value: T): T {'
    ].join('\n')

    expect(extractTickets(source)).toEqual([])
  })
})

describe('indexIssueStates', () => {
  it('maps tickets Linear did not return to null', () => {
    const started = { type: 'started', name: 'In Progress' }

    expect(
      indexIssueStates(
        ['BE-1', 'BE-2'],
        [{ identifier: 'BE-1', state: started }]
      )
    ).toEqual({ 'BE-1': started, 'BE-2': null })
  })
})

describe('expiredTickets', () => {
  it.for([
    ['completed', 'Done'],
    ['canceled', 'Canceled']
  ])('expires a %s ticket', ([type, name]) => {
    expect(expiredTickets({ 'BE-1': { type, name } })).toEqual({
      closed: [{ ticket: 'BE-1', state: name }],
      unknown: []
    })
  })

  it.for([
    ['triage', 'Triage'],
    ['backlog', 'Backlog'],
    ['unstarted', 'Todo'],
    ['started', 'In Progress']
  ])('keeps a %s ticket open', ([type, name]) => {
    expect(expiredTickets({ 'BE-1': { type, name } })).toEqual({
      closed: [],
      unknown: []
    })
  })

  it('reports a ticket Linear does not know as unknown', () => {
    expect(expiredTickets({ 'BE-404': null })).toEqual({
      closed: [],
      unknown: ['BE-404']
    })
  })
})
