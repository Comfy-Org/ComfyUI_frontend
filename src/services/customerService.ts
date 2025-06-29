import axios, { AxiosError, AxiosResponse } from 'axios'
import { ref } from 'vue'

import { COMFY_API_BASE_URL } from '@/config/comfyApi'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { operations } from '@/types/comfyRegistryTypes'
import { isAbortError } from '@/utils/typeGuardUtil'

type CustomerEventsResponse =
  operations['GetCustomerEvents']['responses']['200']['content']['application/json']

type CustomerEventsResponseQuery =
  operations['GetCustomerEvents']['parameters']['query']

const customerApiClient = axios.create({
  baseURL: COMFY_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const useCustomerService = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const handleRequestError = (
    err: unknown,
    context: string,
    routeSpecificErrors?: Record<number, string>
  ) => {
    // Don't treat cancellation as an error
    if (isAbortError(err)) return

    let message: string
    if (!axios.isAxiosError(err)) {
      message = `${context} failed: ${err instanceof Error ? err.message : String(err)}`
    } else {
      const axiosError = err as AxiosError<{ message: string }>
      const status = axiosError.response?.status
      if (status && routeSpecificErrors?.[status]) {
        message = routeSpecificErrors[status]
      } else {
        message =
          axiosError.response?.data?.message ??
          `${context} failed with status ${status}`
      }
    }

    error.value = message
  }

  const executeRequest = async <T>(
    requestCall: () => Promise<AxiosResponse<T>>,
    options: {
      errorContext: string
      routeSpecificErrors?: Record<number, string>
    }
  ): Promise<T | null> => {
    const { errorContext, routeSpecificErrors } = options

    isLoading.value = true
    error.value = null

    try {
      const response = await requestCall()
      return response.data
    } catch (err) {
      handleRequestError(err, errorContext, routeSpecificErrors)
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function getMyEvents({
    page = 1,
    limit = 10
  }: CustomerEventsResponseQuery = {}): Promise<CustomerEventsResponse | null> {
    const errorContext = 'Fetching customer events'
    const routeSpecificErrors = {
      400: 'Invalid input, object invalid',
      404: 'Not found'
    }

    // Get auth headers
    const authHeaders = await useFirebaseAuthStore().getAuthHeader()
    if (!authHeaders) {
      error.value = 'Authentication header is missing'
      return null
    }

    return executeRequest<CustomerEventsResponse>(
      () =>
        customerApiClient.get('/customers/events', {
          params: { page, limit },
          headers: authHeaders
        }),
      { errorContext, routeSpecificErrors }
    )
  }

  return {
    // State
    isLoading,
    error,

    // Methods
    getMyEvents
  }
}
