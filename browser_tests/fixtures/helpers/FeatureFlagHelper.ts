import type { Page, Route } from '@playwright/test'

export class FeatureFlagHelper {
  private featuresRouteHandler: ((route: Route) => void) | null = null

  constructor(private readonly page: Page) {}

  /**
   * Seed feature flags before the app boots, via `/api/features` — the
   * endpoint that populates `remoteConfig` (see `resolveFlag()` in
   * `useFeatureFlags.ts`). Must be called before `comfyPage.setup()` /
   * `page.goto()`.
   *
   * Only reaches flags whose getter falls back to `remoteConfig.value`
   * (most of them); one resolved purely from the server's WS
   * `feature_flags` handshake needs `seedServerFlags()`/
   * `setServerFlagsPersistent()` instead.
   */
  async seedFlags(flags: Record<string, unknown>): Promise<void> {
    await this.mockServerFeatures(flags)
  }

  /**
   * Set feature flags at runtime via localStorage. Uses the `ff:` prefix
   * that devFeatureFlagOverride.ts reads in dev mode.
   * For flags needed before page init, use `seedFlags()` instead.
   */
  async setFlags(flags: Record<string, unknown>): Promise<void> {
    await this.page.evaluate((flagMap: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(flagMap)) {
        localStorage.setItem(`ff:${key}`, JSON.stringify(value))
      }
    }, flags)
  }

  async setFlag(name: string, value: unknown): Promise<void> {
    await this.setFlags({ [name]: value })
  }

  async clearFlags(): Promise<void> {
    await this.page.evaluate(() => {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('ff:')) keysToRemove.push(key)
      }
      keysToRemove.forEach((k) => {
        localStorage.removeItem(k)
      })
    })
  }

  /**
   * Force server feature flags (the WS `feature_flags` handshake payload) on
   * the running app by merging into `api.serverFeatureFlags`. The `ff:`
   * localStorage override is dev-only (tree-shaken from production builds),
   * so this is the way to control `api.serverSupportsFeature()` in e2e.
   *
   * Note: this merges the injected flags at call time. A subsequent WS
   * reconnect or a late `feature_flags` handshake will full-replace
   * `serverFeatureFlags`, dropping the overrides. For flags that must survive
   * reconnects, use `setServerFlagsPersistent()`, which re-applies on each
   * handshake. (`mockServerFeatures()` does not help: it intercepts
   * /api/features, which never populates `serverFeatureFlags`.)
   */
  async setServerFlags(flags: Record<string, unknown>): Promise<void> {
    await this.page.evaluate((flagMap: Record<string, unknown>) => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        ...flagMap
      }
    }, flags)
  }

  /**
   * Force server feature flags and keep them applied across websocket
   * reconnects. Merges the flags into `api.serverFeatureFlags` now, and
   * re-merges on every subsequent `feature_flags` handshake message.
   *
   * The server replies to the client's handshake with a `feature_flags`
   * message on every socket open (including reconnects), and the handler
   * full-replaces `serverFeatureFlags` with that payload, so a plain
   * `setServerFlags` merge is dropped by any later handshake. Re-applying on
   * each `feature_flags` event survives that. `mockServerFeatures` does not
   * help here: it intercepts `/api/features`, which never populates
   * `serverFeatureFlags`.
   */
  async setServerFlagsPersistent(
    flags: Record<string, unknown>
  ): Promise<void> {
    await this.page.evaluate((flagMap: Record<string, unknown>) => {
      const api = window.app!.api
      const apply = () => {
        api.serverFeatureFlags.value = {
          ...api.serverFeatureFlags.value,
          ...flagMap
        }
      }
      apply()
      api.addEventListener('feature_flags', apply)
    }, flags)
  }

  /**
   * Seed server feature flags before the app reads them, for a flag a
   * boot-time action depends on — a `?pricing=` deep link opens its dialog
   * from `onMounted`, so `setServerFlagsPersistent()` lands after the dialog
   * has already chosen a rail.
   *
   * `window.app` is what gates this: it is assigned in `GraphCanvas`'s
   * `onMounted` just before the URL action loaders run, so an accessor
   * installed here applies the flags in that window and re-applies on every
   * later `feature_flags` handshake, as `setServerFlagsPersistent()` does.
   *
   * Must be called before `page.goto()`; init scripts persist for the page
   * lifetime and cannot be removed.
   */
  async seedServerFlags(flags: Record<string, unknown>): Promise<void> {
    await this.page.addInitScript((flagMap: Record<string, unknown>) => {
      let comfyApp: Window['app']
      Object.defineProperty(window, 'app', {
        configurable: true,
        get: () => comfyApp,
        set: (value: Window['app']) => {
          comfyApp = value
          const api = value?.api
          if (!api) return
          const apply = () => {
            api.serverFeatureFlags.value = {
              ...api.serverFeatureFlags.value,
              ...flagMap
            }
          }
          apply()
          api.addEventListener('feature_flags', apply)
        }
      })
    }, flags)
  }

  /**
   * Remove server feature flags and keep them removed across websocket
   * reconnects, pinning the flag-ABSENT state. The real backend may or may
   * not emit a given flag in its `feature_flags` handshake, so a test that
   * asserts absent-flag defaults must strip the key from every handshake
   * rather than trust the server to omit it.
   */
  async clearServerFlagsPersistent(flagNames: string[]): Promise<void> {
    await this.page.evaluate((names: string[]) => {
      const api = window.app!.api
      const apply = () => {
        const flags = { ...api.serverFeatureFlags.value }
        for (const name of names) delete flags[name]
        api.serverFeatureFlags.value = flags
      }
      apply()
      api.addEventListener('feature_flags', apply)
    }, flagNames)
  }

  /**
   * Answer the app's websocket handshake with a `feature_flags` message, which
   * is the channel `api.serverFeatureFlags` is actually populated from
   * (`api.ts:1012`).
   *
   * Early enough for a flag a **boot-time** read depends on, unlike
   * `seedServerFlags()`, which hooks the `window.app` assignment in
   * `GraphCanvas`'s `onMounted` — already too late for anything the billing
   * gate reads while resolving auth and workspace.
   *
   * It is not the *earliest* seam, and for the billing SDK flags it is no
   * longer the primary one. #18141 moved them onto `/api/features`, which boot
   * awaits at `main.ts:56`, so a route stub on that endpoint lands before the
   * handshake. Prefer it for those flags and use this to pin both channels.
   *
   * `ff:` still cannot reach these flags from a spec, though not for the
   * reason this note used to give: `getDevOverride` is tree-shaken outside
   * DEV, and `getSessionOverride` needs a signed-in, email-verified
   * `@comfy.org` identity.
   *
   * Must be called before `page.goto()`. The socket is answered locally and
   * never connected to a server, which suits a fully mocked cloud spec: the
   * app's other websocket traffic has no backend to reach in one anyway.
   */
  async serveServerFlagsOnHandshake(
    flags: Record<string, unknown>
  ): Promise<void> {
    await this.page.routeWebSocket(/\/ws/, (socket) => {
      socket.send(JSON.stringify({ type: 'feature_flags', data: flags }))
    })
  }

  /**
   * Mock server feature flags via route interception on /api/features.
   */
  async mockServerFeatures(features: Record<string, unknown>): Promise<void> {
    this.featuresRouteHandler = (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(features)
      })
    await this.page.route('**/api/features', this.featuresRouteHandler)
  }

  async clearMocks(): Promise<void> {
    if (this.featuresRouteHandler) {
      await this.page.unroute('**/api/features', this.featuresRouteHandler)
      this.featuresRouteHandler = null
    }
  }
}
