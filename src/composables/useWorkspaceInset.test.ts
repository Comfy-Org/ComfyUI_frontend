import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import {
  WORKSPACE_INSET_RIGHT,
  useWorkspaceInsetRight
} from './useWorkspaceInset'

function readInset(): string {
  return document.documentElement.style.getPropertyValue(WORKSPACE_INSET_RIGHT)
}

const scopes: ReturnType<typeof effectScope>[] = []

function runInScope(widthPx: () => number): void {
  const scope = effectScope()
  scopes.push(scope)
  scope.run(() => useWorkspaceInsetRight(widthPx))
}

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  document.documentElement.style.removeProperty(WORKSPACE_INSET_RIGHT)
})

describe('useWorkspaceInsetRight', () => {
  it('publishes the docked width so portaled overlays can offset themselves', () => {
    runInScope(() => 420)

    expect(readInset()).toBe('420px')
  })

  it('tracks the width while a docked surface is resized', async () => {
    const width = ref(420)
    runInScope(() => width.value)

    width.value = 960
    await nextTick()

    expect(readInset()).toBe('960px')
  })

  it('collapses to zero when nothing is docked', async () => {
    const docked = ref(true)
    runInScope(() => (docked.value ? 420 : 0))

    docked.value = false
    await nextTick()

    expect(readInset()).toBe('0px')
  })

  it('stops publishing once the owning scope is torn down', async () => {
    const width = ref(420)
    const scope = effectScope()
    scope.run(() => useWorkspaceInsetRight(() => width.value))
    scope.stop()

    width.value = 960
    await nextTick()

    // Teardown clears the var rather than freezing it at its last published
    // value - a docked surface unmounted mid-close (its host's `v-if` beats
    // its own `docked.value ? width : 0` branch to the flush) must not leave
    // every portaled overlay permanently offset.
    // Addresses review feedback:
    // https://github.com/Comfy-Org/ComfyUI_frontend/pull/16337#discussion_r3892825318
    expect(readInset()).toBe('0px')
  })

  it('clears the inset on teardown even when the last published width was already zero', () => {
    const scope = effectScope()
    scope.run(() => useWorkspaceInsetRight(() => 0))
    scope.stop()

    expect(readInset()).toBe('0px')
  })
})
