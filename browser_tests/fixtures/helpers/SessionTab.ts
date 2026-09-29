import type { Page, Request, WebSocket } from '@playwright/test'
import { expect } from '@playwright/test'

import { FIREBASE_AUTH_ORIGINS } from '@e2e/fixtures/utils/crossOriginSessionConfig'

const SESSION_PATH = '/api/auth/session'
const TOKEN_PATH = '/api/auth/token'
const CLIENT_HEADER = 'x-comfy-client'
const WORKSPACE_HEADER = 'x-comfy-workspace-id'
const AUTHORIZATION_HEADER = 'authorization'

/** Reads that carry the client header without going through the authorizer. */
const UNSCOPED_API_PATHS = ['/api/features', '/api/auth/'] as const

function isFirebaseAuthRequest(url: URL): boolean {
  return (
    FIREBASE_AUTH_ORIGINS.some((origin) => origin === url.origin) ||
    (url.hostname === 'www.googleapis.com' &&
      url.pathname.startsWith('/identitytoolkit/'))
  )
}

function isSessionRequest(url: URL): boolean {
  return url.pathname.startsWith(SESSION_PATH)
}

function isTokenMintRequest(url: URL): boolean {
  return url.pathname === TOKEN_PATH
}

type RequestHeaders = Record<string, string>

export type SessionRequest = {
  workspaceId: string | null
  authorization: string | null
}

function toSessionRequest(headers: RequestHeaders): SessionRequest {
  return {
    workspaceId: headers[WORKSPACE_HEADER] ?? null,
    authorization: headers[AUTHORIZATION_HEADER] ?? null
  }
}

/** Every matching request one tab makes, from the moment it opens. */
export class RequestRecorder {
  private readonly recorded: string[] = []

  constructor(page: Page, matches: (url: URL) => boolean) {
    page.on('request', (request: Request) => {
      const url = new URL(request.url())
      if (!matches(url)) return
      this.recorded.push(`${request.method()} ${url.origin}${url.pathname}`)
    })
  }

  get calls(): readonly string[] {
    return this.recorded
  }

  reset() {
    this.recorded.length = 0
  }

  /** Call once the tab has settled; zero is only meaningful after that. */
  expectNone(label: string) {
    expect(this.recorded, label).toEqual([])
  }
}

export class WebSocketObserver {
  private readonly opened: WebSocket[] = []

  constructor(private readonly page: Page) {
    page.on('websocket', (socket) => this.opened.push(socket))
  }

  reset() {
    this.opened.length = 0
  }

  async waitForSocket(matches: (url: URL) => boolean): Promise<WebSocket> {
    const existing = this.opened.find((socket) =>
      matches(new URL(socket.url()))
    )
    if (existing) return existing
    return this.page.waitForEvent('websocket', (socket) =>
      matches(new URL(socket.url()))
    )
  }

  async waitForClose(socket: WebSocket): Promise<void> {
    if (socket.isClosed()) return
    await socket.waitForEvent('close')
  }
}

type LoggedRequest = { url: URL; headers: RequestHeaders }

/** Every request a tab makes, with headers, until the next reset. */
class RequestLog {
  private readonly entries: Promise<LoggedRequest>[] = []

  constructor(page: Page) {
    page.on('request', (request: Request) => {
      this.entries.push(
        request
          .allHeaders()
          .then((headers) => ({ url: new URL(request.url()), headers }))
      )
    })
  }

  reset() {
    this.entries.length = 0
  }

  private async find(
    apiOrigin: string,
    matches: (request: LoggedRequest) => boolean
  ): Promise<RequestHeaders | undefined> {
    for (const entry of this.entries) {
      const request = await entry
      if (
        request.url.origin === apiOrigin &&
        request.url.pathname.startsWith('/api/') &&
        matches(request)
      ) {
        return request.headers
      }
    }
    return undefined
  }

  async firstMatching(
    apiOrigin: string,
    matches: (request: LoggedRequest) => boolean,
    description: string
  ): Promise<RequestHeaders> {
    const message = `${description} on ${apiOrigin}`
    await expect
      .poll(async () => (await this.find(apiOrigin, matches)) !== undefined, {
        message
      })
      .toBe(true)
    const headers = await this.find(apiOrigin, matches)
    if (!headers) throw new Error(`${message} disappeared after it was seen`)
    return headers
  }
}

/** One site of the shared session, open in the shared browser context. */
export class SessionTab {
  readonly firebaseCalls: RequestRecorder
  readonly sessionCalls: RequestRecorder
  readonly tokenMints: RequestRecorder
  readonly sockets: WebSocketObserver
  private readonly requests: RequestLog

  constructor(
    readonly page: Page,
    readonly origin: string,
    private readonly searchParams: Record<string, string> = {}
  ) {
    this.firebaseCalls = new RequestRecorder(page, isFirebaseAuthRequest)
    this.sessionCalls = new RequestRecorder(page, isSessionRequest)
    this.tokenMints = new RequestRecorder(page, isTokenMintRequest)
    this.sockets = new WebSocketObserver(page)
    this.requests = new RequestLog(page)
  }

  /** Forget what the tab did so far; what follows is what the next step caused. */
  reset() {
    this.firebaseCalls.reset()
    this.sessionCalls.reset()
    this.tokenMints.reset()
    this.sockets.reset()
    this.requests.reset()
  }

  url(path = '/', ff?: string): string {
    const url = new URL(path, this.origin)
    const params =
      ff === undefined ? this.searchParams : { ...this.searchParams, ff }
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    return url.href
  }

  /** `ff` replaces the tab's feature-flag override for this navigation. */
  async goto(path = '/', { ff }: { ff?: string } = {}) {
    const response = await this.page.goto(this.url(path, ff))
    expect(response?.ok(), `${this.origin}${path} loads`).toBe(true)
    return response
  }

  /** The first workspace-scoped ingest request since the last reset. */
  async nextSessionRequest(apiOrigin: string): Promise<SessionRequest> {
    return toSessionRequest(
      await this.requests.firstMatching(
        apiOrigin,
        ({ url, headers }) =>
          CLIENT_HEADER in headers &&
          !UNSCOPED_API_PATHS.some((path) => url.pathname.startsWith(path)),
        'A workspace-scoped session request'
      )
    )
  }

  /** The first Bearer-authorized API request since the last reset. */
  async nextTokenRequest(apiOrigin: string): Promise<SessionRequest> {
    return toSessionRequest(
      await this.requests.firstMatching(
        apiOrigin,
        ({ headers }) =>
          AUTHORIZATION_HEADER in headers &&
          headers[AUTHORIZATION_HEADER].startsWith('Bearer '),
        'A Bearer-authorized request'
      )
    )
  }

  cloudSocket(): Promise<WebSocket> {
    return this.sockets.waitForSocket((url) => url.pathname === '/ws')
  }
}
