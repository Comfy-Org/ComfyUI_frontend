import { vi } from 'vitest'

export const withAgentAuth = vi.fn(
  async <T extends RequestInit>(init: T): Promise<T> => init
)

export const agentSocketToken = vi.fn(
  async (): Promise<string | undefined> => undefined
)

export const hasAgentCredential = vi.fn((): boolean => true)

export const ensureSignedIn = vi.fn(async (): Promise<boolean> => true)
