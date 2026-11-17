import type { User } from 'firebase/auth'

import { assert } from '@/base/assert'
import type { operations } from '@/types/comfyRegistryTypes'

type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

interface AuthStoreAccess {
  readonly currentUser: User | null
  readonly userEmail: string | null | undefined
  getIdToken(): Promise<string | undefined>
  createCustomer(): Promise<CreateCustomerResponse>
  logout(): Promise<void>
  notifyTokenRefreshed(): void
}

let providedUseAuthStore: (() => AuthStoreAccess) | undefined

/** Called by `authStore` when it loads. */
export function provideAuthStore(useStore: () => AuthStoreAccess): void {
  providedUseAuthStore = useStore
}

/** `useAuthStore` for the modules `authStore` depends on, which cannot import it back. */
export function useAuthStoreAccess(): AuthStoreAccess {
  assert(providedUseAuthStore, 'authStore has not provided itself')
  return providedUseAuthStore()
}
