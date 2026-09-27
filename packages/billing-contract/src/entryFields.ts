/**
 * The query shape of an entry URL, in one table so the builder and the parser
 * cannot drift apart: a field is written and read under the same name, and a
 * value that fails the shared charset reports the same code on both sides.
 */

/** Names are provisional; see `contract.ts`. */
export const ENTRY_PARAM_PRODUCT = 'product'
export const ENTRY_PARAM_RETURN_TO = 'return_to'
/** Also what a return URL names the billed workspace under. */
export const ENTRY_PARAM_WORKSPACE = 'workspace'

export type OptionalEntryKey =
  | 'plan'
  | 'correlationId'
  | 'workspaceId'
  | 'teamCreditStopId'

export type InvalidIdentifierCode =
  | 'INVALID_PLAN'
  | 'INVALID_CORRELATION_ID'
  | 'INVALID_WORKSPACE_ID'
  | 'INVALID_TEAM_CREDIT_STOP_ID'

interface OptionalEntryField {
  readonly key: OptionalEntryKey
  readonly param: string
  readonly code: InvalidIdentifierCode
}

export const OPTIONAL_ENTRY_FIELDS: readonly OptionalEntryField[] = [
  { key: 'plan', param: 'plan', code: 'INVALID_PLAN' },
  {
    key: 'correlationId',
    param: 'correlation_id',
    code: 'INVALID_CORRELATION_ID'
  },
  {
    key: 'workspaceId',
    param: ENTRY_PARAM_WORKSPACE,
    code: 'INVALID_WORKSPACE_ID'
  },
  {
    key: 'teamCreditStopId',
    param: 'team_credit_stop_id',
    code: 'INVALID_TEAM_CREDIT_STOP_ID'
  }
]

export type OptionalEntryValues = {
  readonly [K in OptionalEntryKey]?: string
}
