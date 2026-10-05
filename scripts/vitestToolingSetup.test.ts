import { getActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'

it('does not install frontend state or fake timers', () => {
  expect(getActivePinia()).toBeUndefined()
  expect(vi.isFakeTimers()).toBe(false)
})

it.for([
  'https://unit-test.invalid/string',
  new URL('http://unit-test.invalid/url'),
  new Request('https://unit-test.invalid/request')
])('blocks network access for %s', async (input) => {
  await expect(fetch(input)).rejects.toThrow('Blocked a real network request')
})

it('preserves fetch for non-network URLs', async () => {
  const response = await fetch('data:text/plain,tooling')
  expect(await response.text()).toBe('tooling')
})
