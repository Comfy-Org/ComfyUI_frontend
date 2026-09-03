export type UserId = string
export * from './billing/index.js'
export type WorkspaceId = string
export type Namespace = string
export type ScheduleHandle = unknown

export interface IdentitySnapshot {
  userId: UserId
  token: string
}
export interface WorkspaceCredential {
  token: string
  workspaceId: WorkspaceId
  expiresAt: number
}
export interface BillingBalanceResponse {
  balance: number
}
export interface AccountAbortSignal {
  readonly aborted: boolean
}

export class AccountError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
  }
}
export class MalformedResponseError extends AccountError {
  constructor() {
    super('Malformed response')
  }
}
export class StorageClearError extends AccountError {
  constructor() {
    super('Could not clear account storage')
  }
}

export interface SchedulerPort {
  now(): number
  schedule(fn: () => void, delayMs: number): ScheduleHandle
  cancel(handle: ScheduleHandle): void
}
export interface StorageKey {
  namespace: Namespace
  userId: UserId
  workspaceId: WorkspaceId
}
export interface StoredCredentialRecord {
  version: 1
  key: StorageKey
  credential: WorkspaceCredential
}
export interface Decoder<T> {
  decode(input: unknown): T
}
export interface TransportRequest<TBody> {
  method: 'POST' | 'GET'
  path: string
  headers: Readonly<Record<string, string>>
  body?: TBody
  signal: AccountAbortSignal
}
export interface TransportOperation<TInput, TBody, TOutput> {
  idempotent: boolean
  makeRequest(
    input: TInput,
    signal: AccountAbortSignal
  ): TransportRequest<TBody>
  response: Decoder<TOutput>
  mapError(status: number, body: unknown): AccountError
}
export interface AccountOperations {
  exchange: TransportOperation<
    { identity: IdentitySnapshot; workspaceId: WorkspaceId },
    { identityToken: string; workspaceId: WorkspaceId },
    WorkspaceCredential
  >
  balance: TransportOperation<
    { credential: WorkspaceCredential },
    never,
    BillingBalanceResponse
  >
}
export interface AccountHostAdapter {
  namespace: Namespace
  scheduler: SchedulerPort
  acquireIdentity(options?: {
    forceRefresh?: boolean
  }): Promise<IdentitySnapshot | null>
  getActiveWorkspace(): WorkspaceId | null
  storage: {
    read(key: StorageKey): Promise<unknown | null>
    write(key: StorageKey, value: StoredCredentialRecord): Promise<void>
    clear(key: StorageKey): Promise<void>
  }
  operations: AccountOperations
  transport(
    request: TransportRequest<unknown>
  ): Promise<{ status: number; body: unknown }>
}
export type SessionState =
  | { phase: 'idle' }
  | { phase: 'restoring' }
  | {
      phase: 'authenticated'
      credential: WorkspaceCredential
      generation: number
      refreshError?: AccountError
    }
  | { phase: 'refreshing'; credential: WorkspaceCredential; generation: number }
  | { phase: 'signed-out'; error?: AccountError }
export type Loadable<T> =
  | { phase: 'idle' | 'loading' }
  | { phase: 'value'; value: T }
  | { phase: 'empty' }
  | { phase: 'error'; error: AccountError }

export interface SessionClient {
  bootstrap(): Promise<void>
  getState(): SessionState
  getGeneration(): number
  subscribe(listener: (state: SessionState) => void): () => void
  establishSession(workspaceId?: WorkspaceId): Promise<WorkspaceCredential>
  switchWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceCredential>
  refresh(options?: {
    forceIdentityRefresh?: boolean
  }): Promise<WorkspaceCredential>
  clearSession(): Promise<
    { ok: true } | { ok: false; error: StorageClearError }
  >
}
export interface BillingClient {
  getCreditsState(): Loadable<BillingBalanceResponse>
  subscribeCredits(
    listener: (state: Loadable<BillingBalanceResponse>) => void
  ): () => void
  refreshCredits(signal?: AccountAbortSignal): Promise<void>
}

const REFRESH_BUFFER_MS = 300_000
const aliveSignal: AccountAbortSignal = { aborted: false }

async function runOperation<I, B, O>(
  adapter: AccountHostAdapter,
  operation: TransportOperation<I, B, O>,
  input: I,
  signal: AccountAbortSignal,
  remint?: () => Promise<I>
): Promise<O> {
  let currentInput = input
  for (let attempt = 0; attempt < 2; attempt++) {
    const request = operation.makeRequest(currentInput, signal)
    const response = await adapter.transport(request)
    if (response.status >= 200 && response.status < 300)
      return operation.response.decode(response.body)
    if (response.status !== 401 || !operation.idempotent || attempt === 1)
      throw operation.mapError(response.status, response.body)
    if (remint) currentInput = await remint()
  }
  throw new AccountError('Unreachable operation state')
}

function isRecord(
  value: unknown,
  key: StorageKey
): value is StoredCredentialRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<StoredCredentialRecord>
  return (
    item.version === 1 &&
    item.key?.namespace === key.namespace &&
    item.key.userId === key.userId &&
    item.key.workspaceId === key.workspaceId &&
    typeof item.credential?.token === 'string' &&
    item.credential.workspaceId === key.workspaceId &&
    typeof item.credential.expiresAt === 'number'
  )
}

export function createSessionClient(
  adapter: AccountHostAdapter
): SessionClient {
  let state: SessionState = { phase: 'idle' }
  let generation = 0
  let timer: ScheduleHandle | undefined
  let retry = 1_000
  let lastKey: StorageKey | undefined
  const listeners = new Set<(state: SessionState) => void>()
  function publish(next: SessionState) {
    state = next
    listeners.forEach((listener) => listener(state))
  }
  function cancelTimer() {
    if (timer !== undefined) adapter.scheduler.cancel(timer)
    timer = undefined
  }
  function schedule(credential: WorkspaceCredential) {
    cancelTimer()
    const delay = Math.max(
      0,
      credential.expiresAt - REFRESH_BUFFER_MS - adapter.scheduler.now()
    )
    timer = adapter.scheduler.schedule(() => {
      void refresh().catch(() => undefined)
    }, delay)
  }
  async function identityAndKey(workspaceId?: string, forceRefresh = false) {
    const identity = await adapter.acquireIdentity({ forceRefresh })
    const workspace = workspaceId ?? adapter.getActiveWorkspace()
    if (!identity || !workspace) throw new AccountError('No active account')
    return {
      identity,
      key: {
        namespace: adapter.namespace,
        userId: identity.userId,
        workspaceId: workspace
      }
    }
  }
  async function establishSession(
    workspaceId?: string,
    forceIdentityRefresh = false
  ): Promise<WorkspaceCredential> {
    const ownGeneration = generation
    const { identity, key } = await identityAndKey(
      workspaceId,
      forceIdentityRefresh
    )
    const credential = await runOperation(
      adapter,
      adapter.operations.exchange,
      { identity, workspaceId: key.workspaceId },
      aliveSignal
    )
    if (
      generation !== ownGeneration ||
      adapter.getActiveWorkspace() !== key.workspaceId
    )
      throw new AccountError('Stale session result')
    await adapter.storage.write(key, { version: 1, key, credential })
    lastKey = key
    retry = 1_000
    publish({ phase: 'authenticated', credential, generation })
    schedule(credential)
    return credential
  }
  async function refresh(options?: {
    forceIdentityRefresh?: boolean
  }): Promise<WorkspaceCredential> {
    const previous =
      state.phase === 'authenticated' || state.phase === 'refreshing'
        ? state.credential
        : undefined
    if (!previous) throw new AccountError('Not authenticated')
    publish({ phase: 'refreshing', credential: previous, generation })
    try {
      return await establishSession(
        previous.workspaceId,
        options?.forceIdentityRefresh
      )
    } catch (error) {
      const accountError =
        error instanceof AccountError
          ? error
          : new AccountError('Refresh failed')
      publish({
        phase: 'authenticated',
        credential: previous,
        generation,
        refreshError: accountError
      })
      timer = adapter.scheduler.schedule(
        () => {
          void refresh().catch(() => undefined)
        },
        Math.min(retry, REFRESH_BUFFER_MS)
      )
      retry = Math.min(retry * 2, REFRESH_BUFFER_MS)
      throw accountError
    }
  }
  return {
    async bootstrap() {
      publish({ phase: 'restoring' })
      try {
        const { key } = await identityAndKey()
        const value = await adapter.storage.read(key)
        if (!isRecord(value, key)) {
          await adapter.storage.clear(key)
          publish({ phase: 'signed-out' })
          return
        }
        lastKey = key
        publish({
          phase: 'authenticated',
          credential: value.credential,
          generation
        })
        schedule(value.credential)
      } catch (error) {
        publish({
          phase: 'signed-out',
          error:
            error instanceof AccountError
              ? error
              : new AccountError('Restore failed')
        })
      }
    },
    getState: () => state,
    getGeneration: () => generation,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    establishSession,
    async switchWorkspace(workspaceId) {
      generation++
      cancelTimer()
      return establishSession(workspaceId)
    },
    refresh,
    async clearSession() {
      generation++
      cancelTimer()
      publish({ phase: 'signed-out' })
      if (!lastKey) return { ok: true }
      try {
        await adapter.storage.clear(lastKey)
        return { ok: true }
      } catch {
        const error = new StorageClearError()
        publish({ phase: 'signed-out', error })
        return { ok: false, error }
      }
    }
  }
}

export function createBillingClient(
  session: SessionClient,
  adapter: AccountHostAdapter
): BillingClient {
  let state: Loadable<BillingBalanceResponse> = { phase: 'idle' }
  const listeners = new Set<(state: Loadable<BillingBalanceResponse>) => void>()
  function publish(next: Loadable<BillingBalanceResponse>) {
    state = next
    listeners.forEach((listener) => listener(state))
  }
  session.subscribe((next) => {
    if (next.phase !== 'authenticated' && next.phase !== 'refreshing')
      publish({ phase: 'idle' })
  })
  return {
    getCreditsState: () => state,
    subscribeCredits(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async refreshCredits(signal = aliveSignal) {
      const startGeneration = session.getGeneration()
      const current = session.getState()
      if (current.phase !== 'authenticated' && current.phase !== 'refreshing') {
        publish({ phase: 'empty' })
        return
      }
      publish({ phase: 'loading' })
      try {
        const value = await runOperation(
          adapter,
          adapter.operations.balance,
          { credential: current.credential },
          signal,
          async () => ({
            credential: await session.refresh({ forceIdentityRefresh: true })
          })
        )
        if (!signal.aborted && startGeneration === session.getGeneration())
          publish({ phase: 'value', value })
      } catch (error) {
        if (!signal.aborted && startGeneration === session.getGeneration())
          publish({
            phase: 'error',
            error:
              error instanceof AccountError
                ? error
                : new AccountError('Balance failed')
          })
      }
    }
  }
}

export function accountPackageId(): string {
  return '@comfyorg/account'
}
