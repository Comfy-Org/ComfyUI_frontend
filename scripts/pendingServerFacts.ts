import { z } from 'zod'

type TicketReference = {
  line: number
  /** `null` when the first argument is not a ticket string literal. */
  ticket: string | null
}

export type IssueState = { type: string; name: string }

type IssueNode = { identifier: string; state: IssueState }

type ExpiredTickets = {
  closed: { ticket: string; state: string }[]
  unknown: string[]
}

const CALL_PATTERN = /pendingServerFact\s*\(([^,)]*)/g
const TICKET_LITERAL = /^(['"`])(BE-\d+)\1$/

const CLOSED_STATE_TYPES = new Set(['completed', 'canceled'])

// `issue(id:)` is non-nullable in Linear's schema, so one unknown ticket would
// null the whole aliased response. A filter simply omits unknown tickets.
export const ISSUE_STATES_QUERY = `query PendingServerFacts($numbers: [Float!]) {
  issues(first: 250, filter: { team: { key: { eq: "BE" } }, number: { in: $numbers } }) {
    nodes { identifier state { type name } }
  }
}`

const lineAt = (source: string, index: number): number =>
  source.slice(0, index).split('\n').length

export function extractTickets(source: string): TicketReference[] {
  return [...source.matchAll(CALL_PATTERN)].map((match) => ({
    line: lineAt(source, match.index),
    ticket: TICKET_LITERAL.exec(match[1].trim())?.[2] ?? null
  }))
}

export function indexIssueStates(
  tickets: readonly string[],
  nodes: readonly IssueNode[]
): Record<string, IssueState | null> {
  const states = new Map(nodes.map((node) => [node.identifier, node.state]))
  return Object.fromEntries(
    tickets.map((ticket) => [ticket, states.get(ticket) ?? null])
  )
}

export function expiredTickets(
  states: Record<string, IssueState | null>
): ExpiredTickets {
  const entries = Object.entries(states)
  return {
    closed: entries.flatMap(([ticket, state]) =>
      state && CLOSED_STATE_TYPES.has(state.type)
        ? [{ ticket, state: state.name }]
        : []
    ),
    unknown: entries.flatMap(([ticket, state]) => (state ? [] : [ticket]))
  }
}

export type CheckMode = 'online' | 'offline'

export type LinearCredentials = { clientId: string; clientSecret: string }

type Preflight =
  | { kind: 'pass'; message: string }
  | { kind: 'fail'; lines: string[] }
  | { kind: 'query'; credentials: LinearCredentials }

export function preflight({
  mode,
  tickets,
  nonLiteral,
  readCredentials
}: {
  mode: CheckMode
  tickets: readonly string[]
  nonLiteral: readonly string[]
  readCredentials: () => Partial<LinearCredentials>
}): Preflight {
  if (nonLiteral.length) {
    return {
      kind: 'fail',
      lines: [
        "pendingServerFact needs a 'BE-<number>' string literal as its first argument so its expiry can be checked:",
        ...nonLiteral.map((location) => `  ${location}`)
      ]
    }
  }
  if (!tickets.length) {
    return {
      kind: 'pass',
      message: 'No pendingServerFact call sites. Nothing to check.'
    }
  }
  if (mode === 'offline') {
    return {
      kind: 'pass',
      message: `${tickets.length} pendingServerFact ticket(s) are well-formed; expiry is checked by the scheduled job on main.`
    }
  }
  const { clientId, clientSecret } = readCredentials()
  if (!clientId || !clientSecret) {
    return {
      kind: 'fail',
      lines: [
        `Found ${tickets.length} pendingServerFact ticket(s) (${tickets.join(', ')}) but the Linear app credentials are not set.`,
        'Set the LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET secrets so their expiry can be checked.'
      ]
    }
  }
  return { kind: 'query', credentials: { clientId, clientSecret } }
}

export const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token'
export const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql'

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string()
})

const issuesResponseSchema = z.object({
  data: z.object({
    issues: z.object({
      nodes: z.array(
        z.object({
          identifier: z.string(),
          state: z.object({ type: z.string(), name: z.string() })
        })
      )
    })
  })
})

type Fetch = (input: string, init: RequestInit) => Promise<Response>

type Exchange<T> = { ok: true; value: T } | { ok: false; reason: string }

type IssueStatesFetch =
  | { ok: true; states: Record<string, IssueState | null> }
  | { ok: false; reason: string }

const redact = (text: string, secrets: readonly string[]): string =>
  secrets.reduce((redacted, secret) => redacted.replaceAll(secret, '***'), text)

async function postAndParse<T>({
  label,
  fetch,
  url,
  init,
  schema,
  secrets
}: {
  label: string
  fetch: Fetch
  url: string
  init: RequestInit
  schema: z.ZodType<T>
  secrets: readonly string[]
}): Promise<Exchange<T>> {
  let response: Response
  let text: string
  try {
    response = await fetch(url, init)
    text = await response.text()
  } catch (cause) {
    return {
      ok: false,
      reason: redact(`${label} request failed: ${String(cause)}`, secrets)
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      reason: redact(`${label} responded ${response.status}: ${text}`, secrets)
    }
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return {
      ok: false,
      reason: `${label} responded ${response.status} with a body that is not JSON.`
    }
  }
  const parsed = schema.safeParse(body)
  if (parsed.success) return { ok: true, value: parsed.data }
  // A 2xx body can carry the access token, so report the schema issues rather than echoing it.
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ')
  return {
    ok: false,
    reason: `${label} responded ${response.status} with an unexpected shape: ${issues}`
  }
}

export async function fetchIssueStates({
  credentials,
  tickets,
  fetch
}: {
  credentials: LinearCredentials
  tickets: readonly string[]
  fetch: Fetch
}): Promise<IssueStatesFetch> {
  const basic = btoa(`${credentials.clientId}:${credentials.clientSecret}`)
  const token = await postAndParse({
    label: 'Linear token exchange',
    fetch,
    url: LINEAR_TOKEN_URL,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'read'
      }).toString()
    },
    schema: tokenResponseSchema,
    secrets: [credentials.clientSecret, basic]
  })
  if (!token.ok) return token

  const accessToken = token.value.access_token
  const issues = await postAndParse({
    label: 'Linear issues query',
    fetch,
    url: LINEAR_GRAPHQL_URL,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: ISSUE_STATES_QUERY,
        variables: {
          numbers: tickets.map((ticket) => Number(ticket.slice('BE-'.length)))
        }
      })
    },
    schema: issuesResponseSchema,
    secrets: [credentials.clientSecret, basic, accessToken]
  })
  if (!issues.ok) return issues
  return {
    ok: true,
    states: indexIssueStates(tickets, issues.value.data.issues.nodes)
  }
}
