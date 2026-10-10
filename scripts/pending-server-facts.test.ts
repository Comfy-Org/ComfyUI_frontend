import { describe, expect, it } from 'vitest'

import {
  ISSUE_STATES_QUERY,
  LINEAR_GRAPHQL_URL,
  LINEAR_TOKEN_URL,
  expiredTickets,
  extractTickets,
  fetchIssueStates,
  indexIssueStates,
  preflight
} from './pendingServerFacts'

const credentialsMustNotBeRead = () => {
  throw new Error('Linear credentials were read')
}

const credentials = { clientId: 'app-id', clientSecret: 'shh-client-secret' }

describe('preflight', () => {
  it('passes well-formed tickets offline without reading the key', () => {
    expect(
      preflight({
        mode: 'offline',
        tickets: ['BE-1', 'BE-2'],
        nonLiteral: [],
        readCredentials: credentialsMustNotBeRead
      })
    ).toEqual({
      kind: 'pass',
      message:
        '2 pendingServerFact ticket(s) are well-formed; expiry is checked by the scheduled job on main.'
    })
  })

  it.for(['offline', 'online'] as const)(
    'fails a non-literal ticket in %s mode',
    (mode) => {
      expect(
        preflight({
          mode,
          tickets: ['BE-1'],
          nonLiteral: ['src/a.ts:3'],
          readCredentials: () => credentials
        })
      ).toMatchObject({
        kind: 'fail',
        lines: expect.arrayContaining(['  src/a.ts:3'])
      })
    }
  )

  it.for([
    [{}, 'both are missing'],
    [{ clientId: 'app-id' }, 'the secret is missing'],
    [{ clientSecret: 'shh-client-secret' }, 'the id is missing']
  ] as const)(
    'fails closed online naming both secrets when %o (%s)',
    ([partial]) => {
      expect(
        preflight({
          mode: 'online',
          tickets: ['BE-1'],
          nonLiteral: [],
          readCredentials: () => partial
        })
      ).toMatchObject({
        kind: 'fail',
        lines: expect.arrayContaining([
          expect.stringMatching(/LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET/)
        ])
      })
    }
  )

  it('passes without credentials when there are no call sites', () => {
    expect(
      preflight({
        mode: 'online',
        tickets: [],
        nonLiteral: [],
        readCredentials: credentialsMustNotBeRead
      })
    ).toMatchObject({ kind: 'pass' })
  })

  it('queries Linear online with the credentials', () => {
    expect(
      preflight({
        mode: 'online',
        tickets: ['BE-1'],
        nonLiteral: [],
        readCredentials: () => credentials
      })
    ).toEqual({ kind: 'query', credentials })
  })
})

type SentRequest = { url: string; init: RequestInit }

function fakeLinear(routes: Partial<Record<string, () => Response>>) {
  const sent: SentRequest[] = []
  const fetch = async (url: string, init: RequestInit) => {
    sent.push({ url, init })
    const respond = routes[url]
    if (!respond) throw new Error(`Unexpected request to ${url}`)
    return respond()
  }
  return { fetch, sent }
}

const tokenGranted = () =>
  Response.json({
    access_token: 'lin_oauth_token',
    token_type: 'Bearer',
    expires_in: 2591999,
    scope: 'read'
  })

describe('fetchIssueStates', () => {
  it('exchanges the client credentials, then queries issues with the bearer token', async () => {
    const started = { type: 'started', name: 'In Progress' }
    const linear = fakeLinear({
      [LINEAR_TOKEN_URL]: tokenGranted,
      [LINEAR_GRAPHQL_URL]: () =>
        Response.json({
          data: { issues: { nodes: [{ identifier: 'BE-7', state: started }] } }
        })
    })

    const result = await fetchIssueStates({
      credentials,
      tickets: ['BE-7', 'BE-19904'],
      fetch: linear.fetch
    })

    expect(result).toEqual({
      ok: true,
      states: { 'BE-7': started, 'BE-19904': null }
    })
    expect(linear.sent).toEqual([
      {
        url: LINEAR_TOKEN_URL,
        init: {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa('app-id:shh-client-secret')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'grant_type=client_credentials&scope=read'
        }
      },
      {
        url: LINEAR_GRAPHQL_URL,
        init: {
          method: 'POST',
          headers: {
            Authorization: 'Bearer lin_oauth_token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: ISSUE_STATES_QUERY,
            variables: { numbers: [7, 19904] }
          })
        }
      }
    ])
  })

  it('fails with the status when the token exchange is refused, without leaking the secret', async () => {
    const linear = fakeLinear({
      [LINEAR_TOKEN_URL]: () =>
        Response.json(
          {
            error: 'invalid_client',
            echoed: `shh-client-secret ${btoa('app-id:shh-client-secret')}`
          },
          { status: 401 }
        )
    })

    const result = await fetchIssueStates({
      credentials,
      tickets: ['BE-7'],
      fetch: linear.fetch
    })

    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/responded 401: .*invalid_client/)
    })
    expect(JSON.stringify(result)).not.toContain('shh-client-secret')
    expect(JSON.stringify(result)).not.toContain(
      btoa('app-id:shh-client-secret')
    )
    expect(linear.sent.map(({ url }) => url)).toEqual([LINEAR_TOKEN_URL])
  })

  it('fails without echoing the token when the token response has an unexpected shape', async () => {
    const linear = fakeLinear({
      [LINEAR_TOKEN_URL]: () =>
        Response.json({ access_token: 'lin_oauth_token' })
    })

    const result = await fetchIssueStates({
      credentials,
      tickets: ['BE-7'],
      fetch: linear.fetch
    })

    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).not.toContain('lin_oauth_token')
  })

  it('fails when the issues response does not match the query shape', async () => {
    const linear = fakeLinear({
      [LINEAR_TOKEN_URL]: tokenGranted,
      [LINEAR_GRAPHQL_URL]: () =>
        Response.json({ errors: [{ message: 'Cannot query field' }] })
    })

    const result = await fetchIssueStates({
      credentials,
      tickets: ['BE-7'],
      fetch: linear.fetch
    })

    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/Linear issues query responded 200/)
    })
    expect(JSON.stringify(result)).not.toContain('lin_oauth_token')
  })
})

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
