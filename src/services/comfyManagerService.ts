import axios, { AxiosError, AxiosResponse } from 'axios'
import { ref } from 'vue'

import { api } from '@/scripts/api'
import type {
  InstallPackParams,
  InstalledNodesResponse,
  ManagerPackOperation,
  ManagerQueueStatus
} from '@/types/comfyManagerTypes'
import { isAbortError } from '@/utils/typeGuardUtil'

enum ManagerRoute {
  // Task runner queue operations
  START_QUEUE = 'manager/queue/start',
  RESET_QUEUE = 'manager/queue/reset',
  QUEUE_STATUS = 'manager/queue/status',

  // Installed packs management
  INSTALL = 'manager/queue/install',
  UPDATE = 'manager/queue/update',
  UPDATE_ALL = 'manager/queue/update_all',
  UNINSTALL = 'manager/queue/uninstall',
  DISABLE = 'manager/queue/disable',
  LIST_INSTALLED = 'customnode/installed'
}

const managerApiClient = axios.create({
  baseURL: api.apiURL(''),
  headers: {
    'Content-Type': 'application/json'
  }
})

export type OperationResult = {
  success?: boolean
  requiresRestart?: boolean
} | null

interface ExecuteApiRequestOptions {
  errorContext: string
  routeSpecificErrors?: Record<number, string>
  isQueueOperation?: boolean
}

/**
 * Service for interacting with the ComfyUI Manager API
 */
export const useComfyManagerService = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const handleApiError = (
    err: unknown,
    context: string,
    routeSpecificErrors?: Record<number, string>
  ): string => {
    isLoading.value = false

    if (isAbortError(err)) return 'Request cancelled'

    if (!axios.isAxiosError(err)) {
      const message = `${context} failed: ${err instanceof Error ? err.message : String(err)}`
      error.value = message
      return message
    }

    const axiosError = err as AxiosError<{ message: string }>
    const status = axiosError.response?.status

    if (status && routeSpecificErrors?.[status]) {
      error.value = routeSpecificErrors[status]
      return routeSpecificErrors[status]
    }

    if (axiosError.response?.data?.message) {
      error.value = axiosError.response.data.message
      return axiosError.response.data.message
    }

    if (axiosError.message === 'Network Error') {
      const message = `Cannot connect to ComfyUI server. Please ensure it's running.`
      error.value = message
      return message
    }

    const message = `${context} failed with status ${status}`
    error.value = message
    return message
  }

  const executeApiRequest = async <T>(
    apiCall: () => Promise<AxiosResponse<T>>,
    options: ExecuteApiRequestOptions
  ): Promise<T | null> => {
    const { errorContext, routeSpecificErrors, isQueueOperation } = options

    isLoading.value = true
    error.value = null

    try {
      const response = await apiCall()
      if (isQueueOperation) {
        await startQueue()
      }
      return response.data
    } catch (err) {
      handleApiError(err, errorContext, routeSpecificErrors)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const startQueue = async (signal?: AbortSignal) => {
    const errorContext = 'Starting ComfyUI-Manager queue'

    return executeApiRequest<OperationResult>(
      () => managerApiClient.get(ManagerRoute.START_QUEUE, { signal }),
      { errorContext }
    )
  }

  const getQueueStatus = async (signal?: AbortSignal) => {
    const errorContext = 'Getting ComfyUI-Manager queue status'

    return executeApiRequest<ManagerQueueStatus>(
      () => managerApiClient.get(ManagerRoute.QUEUE_STATUS, { signal }),
      { errorContext }
    )
  }

  const resetQueue = async (signal?: AbortSignal) => {
    const errorContext = 'Resetting ComfyUI-Manager queue'

    return executeApiRequest<OperationResult>(
      () => managerApiClient.get(ManagerRoute.RESET_QUEUE, { signal }),
      { errorContext }
    )
  }

  /**
   * Install the pack specified in the params
   */
  const installPack = async (
    params: InstallPackParams,
    signal?: AbortSignal
  ) => {
    const errorContext = `Installing pack ${params.id}`

    return executeApiRequest<OperationResult>(
      () => managerApiClient.post(ManagerRoute.INSTALL, params, { signal }),
      { errorContext, isQueueOperation: true }
    )
  }

  /**
   * Uninstall a pack
   */
  const uninstallPack = async (
    params: ManagerPackOperation,
    signal?: AbortSignal
  ) => {
    const errorContext = `Uninstalling pack ${params.id}`
    const routeSpecificErrors = {
      404: `Pack ${params.id} not found or not installed`
    }

    return executeApiRequest<OperationResult>(
      () => managerApiClient.post(ManagerRoute.UNINSTALL, params, { signal }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  /**
   * Get list of installed custom packs
   */
  const listInstalledPacks = async (signal?: AbortSignal) => {
    const errorContext = 'Fetching installed packs'

    return executeApiRequest<InstalledNodesResponse>(
      () => managerApiClient.get(ManagerRoute.LIST_INSTALLED, { signal }),
      { errorContext }
    )
  }

  /**
   * Disable a pack
   */
  const disablePack = async (
    params: ManagerPackOperation,
    signal?: AbortSignal
  ): Promise<OperationResult> => {
    const errorContext = `Disabling pack ${params.id}`
    const routeSpecificErrors = {
      404: `Pack ${params.id} not found or not installed`,
      409: `Pack ${params.id} is already disabled`
    }

    return executeApiRequest<OperationResult>(
      () => managerApiClient.post(ManagerRoute.DISABLE, params, { signal }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  /**
   * Update a pack to latest or specific version if provided
   */
  const updatePack = async (
    params: ManagerPackOperation,
    signal?: AbortSignal
  ): Promise<OperationResult> => {
    const errorContext = `Updating pack ${params.id}`
    const routeSpecificErrors = {
      404: `Pack ${params.id} not found or not installed`,
      409: `Pack ${params.id} is already at the latest version`
    }

    return executeApiRequest<OperationResult>(
      () => managerApiClient.post(ManagerRoute.UPDATE, params, { signal }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  /**
   * Update all installed packs
   */
  const updateAllPacks = async (signal?: AbortSignal) => {
    const errorContext = 'Updating all packs'

    return executeApiRequest<OperationResult>(
      () => managerApiClient.get(ManagerRoute.UPDATE_ALL, { signal }),
      { errorContext, isQueueOperation: true }
    )
  }

  return {
    // State
    isLoading,
    error,

    // Queue operations
    startQueue,
    getQueueStatus,
    resetQueue,

    // Pack management
    installPack,
    uninstallPack,
    disablePack,
    updatePack,
    updateAllPacks,

    // Pack info
    listInstalledPacks
  }
}
