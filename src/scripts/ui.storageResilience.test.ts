import { describe, expect, it, vi } from 'vitest'

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

// Node >= 25's unconfigured Web Storage stub, installed before the import below
// so the module-scope `new ComfyApp()` restores against it.
// oxlint-disable-next-line comfy/no-module-scope-vitest-mocks -- must precede import-time ComfyApp construction
vi.stubGlobal('localStorage', {} as Storage)

// Imported once here rather than per test behind `vi.resetModules()`, which
// would pay this graph's transform cost again for every test.
const { app } = await import('@/scripts/app')

vi.unstubAllGlobals()

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

describe('menu position restore is resilient to unusable localStorage', () => {
  it('finishes importing @/scripts/app when localStorage is a non-functional stub', () => {
    // Assigned by the `dragElement()` call that reads storage, so its presence
    // means the import-time restore ran instead of throwing.
    expect(app.ui.restoreMenuPosition).toBeTypeOf('function')
  })

  it('restores quietly when localStorage throws on access', () => {
    installThrowingLocalStorage()

    expect(() => app.ui.restoreMenuPosition()).not.toThrow()
  })

  it('restores quietly when the stored position is corrupt JSON', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '{not valid json'),
      setItem: vi.fn()
    } as unknown as Storage)

    expect(() => app.ui.restoreMenuPosition()).not.toThrow()
  })

  it('restores quietly when persisting the restored position fails', () => {
    // A valid stored position reaches `positionElement()`, which writes it back
    // — the other guarded storage access.
    const setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ x: 12, y: 34 })),
      setItem
    } as unknown as Storage)
    // `positionElement()` bails out while the menu is hidden, and setup() hides
    // it by default.
    const { menuContainer } = app.ui
    const display = menuContainer.style.display
    menuContainer.style.display = 'block'

    try {
      expect(() => app.ui.restoreMenuPosition()).not.toThrow()
      expect(setItem).toHaveBeenCalled()
    } finally {
      menuContainer.style.display = display
    }
  })
})
