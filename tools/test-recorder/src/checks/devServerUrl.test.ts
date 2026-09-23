import { afterEach, describe, expect, it } from 'vitest'
import { devServerPort, devServerUrl } from './devServerUrl'

const ENV_KEYS = ['COMFY_TEST_DEV_PORT', 'PLAYWRIGHT_TEST_URL'] as const

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
})

describe('dev server target', () => {
  it('defaults to the Vite port', () => {
    expect(devServerUrl()).toBe('http://localhost:5173')
  })

  it('follows COMFY_TEST_DEV_PORT', () => {
    process.env.COMFY_TEST_DEV_PORT = '5399'
    expect(devServerPort()).toBe(5399)
    expect(devServerUrl()).toBe('http://localhost:5399')
  })

  it('lets PLAYWRIGHT_TEST_URL win, so the check cannot probe elsewhere', () => {
    process.env.PLAYWRIGHT_TEST_URL = 'http://127.0.0.1:4321'
    expect(devServerUrl()).toBe('http://127.0.0.1:4321')
  })

  it('ignores a non-numeric port rather than building a broken url', () => {
    process.env.COMFY_TEST_DEV_PORT = 'not-a-port'
    expect(devServerUrl()).toBe('http://localhost:5173')
  })
})
