// @vitest-environment happy-dom
import { render } from '@testing-library/vue'
import type { Ref } from 'vue'
import { defineComponent, h, nextTick } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'

const VERSION_KEY = 'comfy-workshop-version'

async function versionFor(search: string, remembered?: string) {
  vi.resetModules()
  localStorage.clear()
  if (remembered) localStorage.setItem(VERSION_KEY, remembered)
  history.replaceState({}, '', `/workshop${search}`)
  const { usePrototypeTweaks } = await import('./usePrototypeTweaks')
  let version: Ref<string> | undefined
  render(
    defineComponent({
      setup() {
        version = usePrototypeTweaks().version
        return () => h('span')
      }
    })
  )
  await nextTick()
  return version?.value
}

beforeEach(() => history.replaceState({}, '', '/workshop'))

it('takes the version a link asks for, by either name', async () => {
  expect(await versionFor('?v=v2')).toBe('v2')
  expect(await versionFor('?version=v2')).toBe('v2')
})

it('lets the link win over the version the browser remembers', async () => {
  expect(await versionFor('?version=v2', 'v1')).toBe('v2')
  expect(await versionFor('', 'v1')).toBe('v1')
})

it('remembers the version a link opened, even the default one', async () => {
  expect(await versionFor('?version=v1.2', 'v2')).toBe('v1.2')
  expect(localStorage.getItem(VERSION_KEY)).toBe('v1.2')
})

it('sends a retired version to the screen it became', async () => {
  expect(await versionFor('?v=v2.1')).toBe('v2')
})
