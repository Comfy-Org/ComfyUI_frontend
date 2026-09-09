import type { AxiosError } from 'axios'
import axios from 'axios'
import { watch } from 'vue'

import { useApiRequest } from '@/composables/useApiRequest'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import type { components, operations } from '@/types/comfyRegistryTypes'

// Use generated types from OpenAPI spec
export type ReleaseNote = components['schemas']['ReleaseNote']
type GetReleasesParams = operations['getReleaseNotes']['parameters']['query']

// Use generated error response type
type ErrorResponse = components['schemas']['ErrorResponse']

const releaseApiClient = axios.create({
  baseURL: getComfyApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
})

// Release service for fetching release notes
export const useReleaseService = () => {
  watch(
    () => getComfyApiBaseUrl(),
    (url) => {
      releaseApiClient.defaults.baseURL = url
    }
  )

  const mapError = (
    err: unknown,
    context: string,
    routeSpecificErrors?: Record<number, string>
  ): string => {
    if (!axios.isAxiosError(err))
      return err instanceof Error
        ? t('serviceErrors.contextWithMessage', {
            context,
            message: err.message
          })
        : t('serviceErrors.unknownError', { context })

    const axiosError = err as AxiosError<ErrorResponse>

    if (axiosError.response) {
      const { status, data } = axiosError.response

      if (routeSpecificErrors && routeSpecificErrors[status])
        return routeSpecificErrors[status]

      switch (status) {
        case 400:
          return t('serviceErrors.badRequest', {
            message: data?.message || t('serviceErrors.invalidInput')
          })
        case 401:
          return t('serviceErrors.unauthorized')
        case 403:
          return t('serviceErrors.forbidden', {
            message: data?.message || t('serviceErrors.accessDenied')
          })
        case 404:
          return t('serviceErrors.notFound', {
            message: data?.message || t('serviceErrors.resourceNotFound')
          })
        case 500:
          return t('serviceErrors.serverError', {
            message: data?.message || t('serviceErrors.internalServerError')
          })
        default:
          return t('serviceErrors.contextWithMessage', {
            context,
            message: data?.message || axiosError.message
          })
      }
    }

    return t('serviceErrors.contextWithMessage', {
      context,
      message: axiosError.message
    })
  }

  const { isLoading, error, executeRequest } = useApiRequest({
    client: releaseApiClient,
    mapError
  })

  // Fetch release notes from API
  const getReleases = async (
    params: GetReleasesParams,
    options: { signal?: AbortSignal; deployEnvironment?: string } = {}
  ): Promise<ReleaseNote[] | null> => {
    const { signal, deployEnvironment } = options
    const endpoint = '/releases'
    const errorContext = t('serviceErrors.context.getReleases')
    const routeSpecificErrors = {
      400: t('serviceErrors.route.invalidProjectOrVersion')
    }

    const apiResponse = await executeRequest(
      (client) =>
        client.get<ReleaseNote[]>(endpoint, {
          params,
          signal,
          headers: deployEnvironment
            ? { 'Comfy-Env': deployEnvironment }
            : undefined
        }),
      { errorContext, routeSpecificErrors }
    )

    return apiResponse
  }

  return {
    isLoading,
    error,
    getReleases
  }
}
