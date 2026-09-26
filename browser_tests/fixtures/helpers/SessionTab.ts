import type { Page, Request, Response, WebSocket } from '@playwright/test'
import { expect } from '@playwright/test'

import { FIREBASE_AUTH_ORIGINS } from '@e2e/fixtures/utils/crossOriginSessionConfig'

export const SESSION_PATH = '/api/auth/session'
const WORKSPACE_HEADER = 'x-comfy-workspace-id'

function isFirebaseAuthRequest(url: URL): boolean {
  return (
    FIREBASE_AUTH_ORIGINS.some((origin) => origin === url.origin) ||
    (url.hostname === 'www.googleapis.com' &&
      url.pathname.startsWith('/identitytoolkit/'))
  )
}

function isSessionRequest(url: URL): boolean {
  return url.pathname.startsWith('/api/auth/session')
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

/** One site of the shared session, open in the shared browser context. */
export class SessionTab {
  readonly firebaseCalls: RequestRecorder
  readonly sessionCalls: RequestRecorder
  readonly sockets: WebSocketObserver

  constructor(
    readonly page: Page,
    readonly origin: string,
    private readonly searchParams: Record<string, string> = {}
  ) {
    this.firebaseCalls = new RequestRecorder(page, isFirebaseAuthRequest)
    this.sessionCalls = new RequestRecorder(page, isSessionRequest)
    this.sockets = new WebSocketObserver(page)
  }

  url(path = '/'): string {
    const url = new URL(path, this.origin)
    for (const [key, value] of Object.entries(this.searchParams)) {
      url.searchParams.set(key, value)
    }
    return url.href
  }

  async goto(path = '/') {
    const response = await this.page.goto(this.url(path))
    expect(response?.ok(), `${this.origin}${path} loads`).toBe(true)
    return response
  }

  /** The next response to `method url`, query string ignored. */
  waitForResponse(method: string, url: string): Promise<Response> {
    return this.page.waitForResponse((response) => {
      const { origin, pathname } = new URL(response.url())
      return (
        response.request().method() === method && `${origin}${pathname}` === url
      )
    })
  }

  /** The workspace the tab's next scoped API request runs in. */
  async nextWorkspaceId(apiOrigin: string): Promise<string | null> {
    const request = await this.page.waitForRequest(
      (candidate) =>
        candidate.url().startsWith(`${apiOrigin}/api/`) &&
        WORKSPACE_HEADER in candidate.headers()
    )
    return request.headerValue(WORKSPACE_HEADER)
  }
}
