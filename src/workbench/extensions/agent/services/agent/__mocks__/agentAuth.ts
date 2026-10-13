import { vi } from 'vitest'

export const withAgentAuth = vi.fn(
  async <T extends RequestInit>(init: T): Promise<T> => init
)

export const agentSocketParams = vi.fn(
  async (): Promise<URLSearchParams> => new URLSearchParams()
)

export const hasAgentCredential = vi.fn((): boolean => true)

export const ensureSignedIn = vi.fn(async (): Promise<boolean> => true)
