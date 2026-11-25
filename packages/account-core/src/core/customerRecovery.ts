/**
 * Self-healing for accounts whose customer record was never provisioned.
 *
 * Customer creation runs after the Firebase session is established during
 * sign-in/sign-up, so an interruption (navigation, closed tab, network
 * failure) can leave a permanently signed-in user without a customer
 * record. Sessions restored from persisted credentials never re-run the
 * sign-in flow, so every /customers/* request fails with 409 and nothing
 * ever retries the creation. The cloud app's rule, shared so every host
 * heals the same way.
 */

/**
 * The auth middleware rejects requests for accounts without a customer
 * record using this exact message. Business-level 409s from /customers/*
 * endpoints (e.g. conflicting subscription state) must NOT trigger
 * provisioning or a blind retry of a payment request.
 */
export const MISSING_CUSTOMER_MESSAGE = 'Failed to find customer'

export async function isMissingCustomerResponse(
  response: Response
): Promise<boolean> {
  if (response.status !== 409) return false
  try {
    const body: unknown = await response.clone().json()
    return (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      body.message === MISSING_CUSTOMER_MESSAGE
    )
  } catch {
    return false
  }
}

export function isCustomerEndpoint(input: string, base?: string): boolean {
  try {
    const { pathname } = new URL(input, base)
    return pathname === '/customers' || pathname.startsWith('/customers/')
  } catch {
    return false
  }
}

export interface CustomerRecoveryDeps {
  /** The request itself; run again, once, after a successful recovery. */
  readonly request: () => Promise<Response>
  /** Provisions the customer; the host deduplicates concurrent callers. */
  readonly recoverMissingCustomer: () => Promise<void>
  /**
   * False once the signed-in identity is no longer the one that started the
   * request: recovery and retry are then skipped and the 409 returned.
   */
  readonly identityUnchanged?: () => boolean
}

/**
 * On a missing-customer 409 this provisions the customer record and retries
 * the original request a single time. If recovery fails, the original 409
 * response is returned so callers surface their normal error handling.
 */
async function retryAfterCustomerRecovery(
  response: Response,
  deps: CustomerRecoveryDeps
): Promise<Response> {
  const {
    request,
    recoverMissingCustomer,
    identityUnchanged = () => true
  } = deps
  if (!(await isMissingCustomerResponse(response)) || !identityUnchanged()) {
    return response
  }

  try {
    await recoverMissingCustomer()
  } catch (error) {
    console.warn(
      'Customer provisioning during 409 recovery failed; returning original response',
      error
    )
    return response
  }

  if (!identityUnchanged()) {
    return response
  }

  try {
    return await request()
  } catch (error) {
    console.warn(
      'Retry after customer provisioning failed; returning original 409 response',
      error
    )
    return response
  }
}

/**
 * The recovery above, applied only to /customers/* endpoints: a 409 from
 * anywhere else is never a missing customer.
 */
export async function fetchWithCustomerRecovery(
  input: string,
  deps: CustomerRecoveryDeps & {
    /** Resolves a relative `input`; a browser host passes its page href. */
    readonly base?: string
  }
): Promise<Response> {
  const response = await deps.request()
  if (!isCustomerEndpoint(input, deps.base)) return response
  return retryAfterCustomerRecovery(response, deps)
}
