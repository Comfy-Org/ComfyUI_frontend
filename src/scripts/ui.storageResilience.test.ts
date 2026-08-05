import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `src/scripts/app.ts` ends with `export const app = new ComfyApp()`, so the
 * ComfyApp constructor runs as an import-time side effect. That constructor
 * reaches `ComfyUI.setup()` -> `dragElement()` -> `restorePos()`, which reads
 * `localStorage`.
 *
 * Node >= 25 installs a Web Storage stub on `globalThis` that is present but
 * non-functional unless `--localstorage-file` is passed, and it shadows the one
 * happy-dom would otherwise provide. Before this was guarded, importing
 * `@/scripts/app` under such a host died with
 * `TypeError: localStorage.getItem is not a function` — which is why the repo
 * has to pass `--no-experimental-webstorage` via pnpm's `nodeOptions`, and why
 * so many suites mock `@/scripts/app` purely to dodge the import side effect.
 *
 * These tests pin the degradation as non-fatal.
 */

/** Mirrors Node >= 25's unconfigured Web Storage stub: present but unusable. */
function installDegradedLocalStorage() {
  vi.stubGlobal('localStorage', {} as Storage)
}

/** Mirrors a browser that throws on access (private mode / blocked cookies). */
function installThrowingLocalStorage() {
  vi.stubGlobal('localStorage', {
    getItem() {
      throw new Error('Access to storage is not allowed from this context.')
    },
    setItem() {
      throw new Error('Access to storage is not allowed from this context.')
    }
  } as unknown as Storage)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('menu position restore is resilient to unusable localStorage', () => {
  it('imports @/scripts/app when localStorage is a non-functional stub', async () => {
    installDegradedLocalStorage()
    vi.resetModules()

    const mod = await import('@/scripts/app')

    expect(mod.app).toBeDefined()
  })

  it('imports @/scripts/app when localStorage throws on access', async () => {
    installThrowingLocalStorage()
    vi.resetModules()

    const mod = await import('@/scripts/app')

    expect(mod.app).toBeDefined()
  })

  it('imports @/scripts/app when the stored position is corrupt JSON', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '{not valid json'),
      setItem: vi.fn()
    } as unknown as Storage)
    vi.resetModules()

    const mod = await import('@/scripts/app')

    expect(mod.app).toBeDefined()
  })
})
