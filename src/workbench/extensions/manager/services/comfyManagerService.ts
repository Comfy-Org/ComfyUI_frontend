import type { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

import { useApiRequest } from '@/composables/useApiRequest'
import { api } from '@/scripts/api'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import type { components } from '@/workbench/extensions/manager/types/generatedManagerTypes'

type ManagerQueueStatus = components['schemas']['QueueStatus']
type InstallPackParams = components['schemas']['InstallPackParams']
type InstalledPacksResponse = components['schemas']['InstalledPacksResponse']
type UpdateAllPacksParams = components['schemas']['UpdateAllPacksParams']
type UpdateComfyUIParams = components['schemas']['UpdateComfyUIParams']
type ManagerTaskHistory = components['schemas']['HistoryResponse']
type QueueTaskItem = components['schemas']['QueueTaskItem']

const GENERIC_SECURITY_ERR_MSG =
  'Forbidden: A security error has occurred. Please check the terminal logs'

/**
 * API routes for ComfyUI Manager
 */
enum ManagerRoute {
  START_QUEUE = 'manager/queue/start',
  RESET_QUEUE = 'manager/queue/reset',
  QUEUE_STATUS = 'manager/queue/status',
  UPDATE_ALL = 'manager/queue/update_all',
  UPDATE_COMFYUI = 'manager/queue/update_comfyui',
  LIST_INSTALLED = 'customnode/installed',
  GET_NODES = 'customnode/getmappings',
  IMPORT_FAIL_INFO = 'customnode/import_fail_info',
  IMPORT_FAIL_INFO_BULK = 'customnode/import_fail_info_bulk',
  REBOOT = 'manager/reboot',
  IS_LEGACY_MANAGER_UI = 'manager/is_legacy_manager_ui',
  TASK_HISTORY = 'manager/queue/history',
  QUEUE_TASK = 'manager/queue/task'
}

const managerApiClient = axios.create({
  baseURL: api.apiURL('/v2/'),
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Service for interacting with the ComfyUI Manager API
 * Provides methods for managing packs, ComfyUI-Manager queue operations, and system functions
 * Note: This service should only be used when Manager state is NEW_UI
 */
export const useComfyManagerService = () => {
  // Check if manager service should be available
  const isManagerServiceAvailable = () => {
    const managerState = useManagerState()
    return managerState.isNewManagerUI.value
  }

  const mapError = (
    err: unknown,
    context: string,
    routeSpecificErrors?: Record<number, string>
  ): string => {
    if (!axios.isAxiosError(err)) {
      return `${context} failed: ${err instanceof Error ? err.message : String(err)}`
    }

    const axiosError = err as AxiosError<{ message: string }>
    const status = axiosError.response?.status
    if (status && routeSpecificErrors?.[status]) {
      return routeSpecificErrors[status]
    }
    if (status === 404) {
      return 'Could not connect to ComfyUI-Manager'
    }

    return (
      axiosError.response?.data?.message ??
      `${context} failed with status ${status}`
    )
  }

  const {
    isLoading,
    error,
    executeRequest: sendRequest
  } = useApiRequest({
    client: managerApiClient,
    mapError
  })

  const executeRequest = <T>(
    apiCall: (client: AxiosInstance) => Promise<AxiosResponse<T>>,
    options: {
      errorContext: string
      routeSpecificErrors?: Record<number, string>
      isQueueOperation?: boolean
    }
  ): Promise<T | null> => {
    // Block service calls if not in NEW_UI state
    if (!isManagerServiceAvailable()) {
      error.value = 'Manager service is not available in current mode'
      return Promise.resolve(null)
    }

    const { isQueueOperation, ...requestOptions } = options
    return sendRequest(apiCall, {
      ...requestOptions,
      onSuccess: isQueueOperation ? startQueue : undefined
    })
  }

  const startQueue = async (signal?: AbortSignal) => {
    const errorContext = 'Starting ComfyUI-Manager job queue'
    const routeSpecificErrors = {
      201: 'Created: ComfyUI-Manager job queue is already running'
    }

    return executeRequest<null>(
      (client) => client.post(ManagerRoute.START_QUEUE, null, { signal }),
      { errorContext, routeSpecificErrors }
    )
  }

  const getQueueStatus = async (client_id?: string, signal?: AbortSignal) => {
    const errorContext = 'Getting ComfyUI-Manager queue status'

    return executeRequest<ManagerQueueStatus>(
      (client) =>
        client.get(ManagerRoute.QUEUE_STATUS, {
          params: client_id ? { client_id } : undefined,
          signal
        }),
      { errorContext }
    )
  }

  const listInstalledPacks = async (signal?: AbortSignal) => {
    const errorContext = 'Fetching installed packs'

    return executeRequest<InstalledPacksResponse>(
      (client) => client.get(ManagerRoute.LIST_INSTALLED, { signal }),
      { errorContext }
    )
  }

  const getImportFailInfo = async (signal?: AbortSignal) => {
    const errorContext = 'Fetching import failure information'

    return executeRequest<Record<string, unknown>>(
      (client) => client.get(ManagerRoute.IMPORT_FAIL_INFO, { signal }),
      { errorContext }
    )
  }

  const getImportFailInfoBulk = async (
    params: components['schemas']['ImportFailInfoBulkRequest'] = {},
    signal?: AbortSignal
  ) => {
    const errorContext = 'Fetching bulk import failure information'

    if (!params.cnr_ids?.length && !params.urls?.length) {
      return {}
    }

    return executeRequest<components['schemas']['ImportFailInfoBulkResponse']>(
      (client) =>
        client.post(ManagerRoute.IMPORT_FAIL_INFO_BULK, params, {
          signal
        }),
      { errorContext }
    )
  }

  const queueTask = async (
    kind: QueueTaskItem['kind'],
    params: QueueTaskItem['params'],
    ui_id?: string,
    signal?: AbortSignal
  ) => {
    const task: QueueTaskItem = {
      kind,
      params,
      ui_id: ui_id || uuidv4(),
      client_id: api.clientId ?? api.initialClientId ?? 'unknown'
    }

    const errorContext = `Queueing ${task.kind} task`
    const routeSpecificErrors = {
      403: GENERIC_SECURITY_ERR_MSG,
      404: `Not Found: Task could not be queued`
    }

    return executeRequest<null>(
      (client) => client.post(ManagerRoute.QUEUE_TASK, task, { signal }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  const installPack = async (
    params: InstallPackParams,
    ui_id?: string,
    signal?: AbortSignal
  ) => {
    return queueTask('install', params, ui_id, signal)
  }

  const uninstallPack = async (
    params: components['schemas']['UninstallPackParams'],
    ui_id?: string,
    signal?: AbortSignal
  ) => {
    return queueTask('uninstall', params, ui_id, signal)
  }

  const disablePack = async (
    params: components['schemas']['DisablePackParams'],
    ui_id?: string,
    signal?: AbortSignal
  ): Promise<null> => {
    return queueTask('disable', params, ui_id, signal)
  }

  const enablePack = async (
    params: components['schemas']['EnablePackParams'],
    ui_id?: string,
    signal?: AbortSignal
  ): Promise<null> => {
    return queueTask('enable', params, ui_id, signal)
  }

  const updatePack = async (
    params: components['schemas']['UpdatePackParams'],
    ui_id?: string,
    signal?: AbortSignal
  ): Promise<null> => {
    return queueTask('update', params, ui_id, signal)
  }

  const updateAllPacks = async (
    params: UpdateAllPacksParams = {},
    ui_id?: string,
    signal?: AbortSignal
  ) => {
    const errorContext = 'Updating all packs'
    const routeSpecificErrors = {
      403: 'Forbidden: To use this action, a security_level of `middle or below` is required',
      401: 'Unauthorized: ComfyUI-Manager job queue is busy'
    }

    const queryParams = {
      mode: params.mode,
      client_id: api.clientId ?? api.initialClientId ?? 'unknown',
      ui_id: ui_id || uuidv4()
    }

    return executeRequest<null>(
      (client) =>
        client.post(ManagerRoute.UPDATE_ALL, null, {
          params: queryParams,
          signal
        }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  const updateComfyUI = async (
    params: UpdateComfyUIParams = { is_stable: true },
    ui_id?: string,
    signal?: AbortSignal
  ) => {
    const errorContext = 'Updating ComfyUI'
    const routeSpecificErrors = {
      400: 'Bad Request: Missing required parameters',
      403: 'Forbidden: To use this action, a security_level of `middle or below` is required'
    }

    const queryParams = {
      client_id: api.clientId ?? api.initialClientId ?? 'unknown',
      ui_id: ui_id || uuidv4(),
      ...params
    }

    return executeRequest<null>(
      (client) =>
        client.post(ManagerRoute.UPDATE_COMFYUI, null, {
          params: queryParams,
          signal
        }),
      { errorContext, routeSpecificErrors, isQueueOperation: true }
    )
  }

  const rebootComfyUI = async (signal?: AbortSignal) => {
    const errorContext = 'Rebooting ComfyUI'
    const routeSpecificErrors = {
      403: 'Forbidden: Rebooting ComfyUI requires security_level of middle or below'
    }

    return executeRequest<null>(
      (client) => client.post(ManagerRoute.REBOOT, null, { signal }),
      { errorContext, routeSpecificErrors }
    )
  }

  const isLegacyManagerUI = async (signal?: AbortSignal) => {
    const errorContext = 'Checking if user set Manager to use the legacy UI'

    return executeRequest<{ is_legacy_manager_ui: boolean }>(
      (client) => client.get(ManagerRoute.IS_LEGACY_MANAGER_UI, { signal }),
      { errorContext }
    )
  }

  const getTaskHistory = async (
    options: {
      ui_id?: string
      max_items?: number
      client_id?: string
      offset?: number
    } = {},
    signal?: AbortSignal
  ) => {
    const errorContext = 'Getting ComfyUI-Manager task history'

    return executeRequest<ManagerTaskHistory>(
      (client) =>
        client.get(ManagerRoute.TASK_HISTORY, {
          params: options,
          signal
        }),
      { errorContext }
    )
  }

  return {
    // State
    isLoading,
    error,

    // Queue operations
    startQueue,
    getQueueStatus,
    getTaskHistory,

    // Pack management
    listInstalledPacks,
    getImportFailInfo,
    getImportFailInfoBulk,
    installPack,
    uninstallPack,
    enablePack,
    disablePack,
    updatePack,
    updateAllPacks,

    // System operations
    updateComfyUI,
    rebootComfyUI,
    isLegacyManagerUI
  }
}
