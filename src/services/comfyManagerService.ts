import axios, { AxiosError, AxiosResponse } from 'axios'
import { ref } from 'vue'

import { api } from '@/scripts/api'
import {
  type InstallPackParams,
  type InstalledPacksResponse,
  type ManagerPackInfo,
  type ManagerQueueStatus,
  SelectedVersion,
  type UpdateAllPacksParams
} from '@/types/comfyManagerTypes'
import { isAbortError } from '@/utils/typeGuardUtil'

const GENERIC_SECURITY_ERR_MSG =
  'Forbidden: A security error has occurred. Please check the terminal logs'

/**
 * API routes for ComfyUI Manager
 */
enum ManagerRoute {
  START_QUEUE = 'manager/queue/start',
  RESET_QUEUE = 'manager/queue/reset',
  QUEUE_STATUS = 'manager/queue/status',
  INSTALL = 'manager/queue/install',
  UPDATE = 'manager/queue/update',
  UPDATE_ALL = 'manager/queue/update_all',
  UNINSTALL = 'manager/queue/uninstall',
  DISABLE = 'manager/queue/disable',
  FIX_NODE = 'manager/queue/fix',
  LIST_INSTALLED = 'customnode/installed',
  GET_NODES = 'customnode/getmappings',
  GET_PACKS = 'customnode/getlist',
  IMPORT_FAIL_INFO = 'customnode/import_fail_info',
  REBOOT = 'manager/reboot'
}

const managerApiClient = axios.create({
  baseURL: api.apiURL(''),
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Service for interacting with the ComfyUI Manager API
 * Provides methods for managing packs, ComfyUI-Manager queue operations, and system functions
 */
export const useComfyManagerService = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const didStartQueue = ref(false)

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
      } else if (status === 404) {
        message = 'Could not connect to ComfyUI-Manager'
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
      isQueueOperation?: boolean
    }
  ): Promise<T | null> => {
    const { errorContext, routeSpecificErrors, isQueueOperation } = options

    isLoading.value = true
    error.value = null

    try {
      const response = await requestCall()
      if (isQueueOperation) await startQueue()
      return response.data
    } catch (err) {
      handleRequestError(err, errorContext, routeSpecificErrors)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const startQueue = async (signal?: AbortSignal) => {
    const errorContext = 'Starting ComfyUI-Manager job queue'
    const routeSpecificErrors = {
      201: 'Created: ComfyUI-Manager job queue is already running'
    }

    didStartQueue.value = true

    return executeRequest<null>(
      () => managerApiClient.get(ManagerRoute.START_QUEUE, { signal }),
      { errorContext, routeSpecificErrors }
    )
  }

  const getQueueStatus = async (signal?: AbortSignal) => {
    const errorContext = 'Getting ComfyUI-Manager queue status'

    return executeRequest<ManagerQueueStatus>(
      () => managerApiClient.get(ManagerRoute.QUEUE_STATUS, { signal }),
      { errorContext }
    )
  }

  const resetQueue = async (signal?: AbortSignal) => {
    const errorContext = 'Resetting ComfyUI-Manager queue'

    return executeRequest<null>(
      () => managerApiClient.get(ManagerRoute.RESET_QUEUE, { signal }),
      { errorContext }
    )
  }

  const listInstalledPacks = async (signal?: AbortSignal) => {
    const errorContext = 'Fetching installed packs'

    return executeRequest<InstalledPacksResponse>(
      () => managerApiClient.get(ManagerRoute.LIST_INSTALLED, { signal }),
      { errorContext }
    )
  }

  const getImportFailInfo = async (signal?: AbortSignal) => {
    const errorContext = 'Fetching import failure information'

    return executeRequest<any>(
      () => managerApiClient.get(ManagerRoute.IMPORT_FAIL_INFO, { signal }),
      { errorContext }
    )
  }

  const installPack = async (
    params: InstallPackParams,
    signal?: AbortSignal
  ) => {
    const errorContext = `Installing pack ${params.id}`
    const routeSpecificErrors = {
      403: GENERIC_SECURITY_ERR_MSG,
      404:
        params.selected_version === SelectedVersion.NIGHTLY
          ? `Not Found: Node pack ${params.id} does not provide nightly version`
          : GENERIC_SECURITY_ERR_MSG
    }

    return executeRequest<null>(
      () => managerApiClient.post(ManagerRoute.INSTALL, params, { signal }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  const uninstallPack = async (
    params: ManagerPackInfo,
    signal?: AbortSignal
  ) => {
    const errorContext = `Uninstalling pack ${params.id}`
    const routeSpecificErrors = {
      403: GENERIC_SECURITY_ERR_MSG
    }

    return executeRequest<null>(
      () => managerApiClient.post(ManagerRoute.UNINSTALL, params, { signal }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  const disablePack = async (
    params: ManagerPackInfo,
    signal?: AbortSignal
  ): Promise<null> => {
    const errorContext = `Disabling pack ${params.id}`
    const routeSpecificErrors = {
      404: `Pack ${params.id} not found or not installed`,
      409: `Pack ${params.id} is already disabled`
    }

    return executeRequest<null>(
      () => managerApiClient.post(ManagerRoute.DISABLE, params, { signal }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  const updatePack = async (
    params: ManagerPackInfo,
    signal?: AbortSignal
  ): Promise<null> => {
    const errorContext = `Updating pack ${params.id}`
    const routeSpecificErrors = {
      403: GENERIC_SECURITY_ERR_MSG
    }

    return executeRequest<null>(
      () => managerApiClient.post(ManagerRoute.UPDATE, params, { signal }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  const updateAllPacks = async (
    params?: UpdateAllPacksParams,
    signal?: AbortSignal
  ) => {
    const errorContext = 'Updating all packs'
    const routeSpecificErrors = {
      403: 'Forbidden: To use this action, a security_level of `middle or below` is required',
      401: 'Unauthorized: ComfyUI-Manager job queue is busy'
    }

    return executeRequest<null>(
      () => managerApiClient.get(ManagerRoute.UPDATE_ALL, { params, signal }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  const rebootComfyUI = async (signal?: AbortSignal) => {
    const errorContext = 'Rebooting ComfyUI'
    const routeSpecificErrors = {
      403: 'Forbidden: Rebooting ComfyUI requires security_level of middle or below'
    }

    return executeRequest<null>(
      () => managerApiClient.get(ManagerRoute.REBOOT, { signal }),
      { errorContext, routeSpecificErrors }
    )
  }

  return {
    // State
    isLoading,
    error,

    // Queue operations
    startQueue,
    resetQueue,
    getQueueStatus,

    // Pack management
    listInstalledPacks,
    getImportFailInfo,
    installPack,
    uninstallPack,
    enablePack: installPack, // enable is done via install
    disablePack,
    updatePack,
    updateAllPacks,

    // System operations
    rebootComfyUI
  }
}
