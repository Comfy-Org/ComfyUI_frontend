import { beforeEach, vi } from 'vitest'

const SPIED_CONSOLE_METHODS = ['debug', 'error', 'info', 'log', 'warn'] as const

beforeEach(() => {
  for (const method of SPIED_CONSOLE_METHODS) vi.spyOn(console, method)
})
