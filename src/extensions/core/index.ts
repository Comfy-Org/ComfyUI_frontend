import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { clearOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
import { isCloud, isNightly } from '@/platform/distribution/types'
import { useExtensionService } from '@/platform/extensions/services/extensionService'
import type { ComfyExtension } from '@/types/comfy'
import type { Surface } from '@comfyorg/telemetry/reportError'
import { reportError } from '@comfyorg/telemetry/reportError'

import { clipspaceExtension } from './clipspace'
import { contextMenuFilterExtension } from './contextMenuFilter'
import { createBoundingBoxesExtension } from './createBoundingBoxes'
import { customWidgetsExtension } from './customWidgets'
import { dynamicPromptsExtension } from './dynamicPrompts'
import { editAttentionExtension } from './editAttention'
import { registerElectronAdapterExtension } from './electronAdapter'
import { groupNodeExtension } from './groupNode'
import { groupOptionsExtension } from './groupOptions'
import { imageCompareExtension } from './imageCompare'
import { imageCompositorExtension } from './imageCompositor'
import { imageCropExtension } from './imageCrop'
import { layerEditorExtension } from './layerEditor'
import { load3dLazyExtension } from './load3d/load3dLazy'
import { maskEditorExtension } from '@/renderer/extensions/maskEditor/extension'
import { noteNodeExtension } from './noteNode'
import { painterExtension } from './painter'
import { previewAnyExtension } from './previewAny'
import { rerouteNodeExtension } from './rerouteNode'
import { saveImageExtraOutputExtension } from './saveImageExtraOutput'
import { saveTextExtension } from './saveText'
import { selectionBorderExtension } from './selectionBorder'
import { simpleTouchSupportExtension } from './simpleTouchSupport'
import { slotDefaultsExtension } from './slotDefaults'
import {
  audioWidgetExtension,
  recordAudioExtension,
  uploadAudioExtension
} from './uploadAudio'
import { uploadImageExtension } from './uploadImage'
import { webcamCaptureExtension } from './webcamCapture'
import { widgetInputsExtension } from './widgetInputs'

const baseCoreExtensions: ComfyExtension[] = [
  clipspaceExtension,
  contextMenuFilterExtension,
  createBoundingBoxesExtension,
  customWidgetsExtension,
  dynamicPromptsExtension,
  editAttentionExtension,
  widgetInputsExtension,
  groupNodeExtension,
  groupOptionsExtension,
  imageCompareExtension,
  imageCompositorExtension,
  imageCropExtension,
  layerEditorExtension,
  load3dLazyExtension,
  maskEditorExtension,
  noteNodeExtension,
  painterExtension,
  previewAnyExtension,
  saveTextExtension,
  rerouteNodeExtension,
  saveImageExtraOutputExtension,
  selectionBorderExtension,
  simpleTouchSupportExtension,
  slotDefaultsExtension,
  audioWidgetExtension,
  uploadAudioExtension,
  recordAudioExtension,
  uploadImageExtension,
  webcamCaptureExtension
]

const disposers: (() => void)[] = []
let registration: Promise<void> | undefined

function register(extension: ComfyExtension) {
  disposers.push(useExtensionService().registerExtension(extension))
}

function isNamedComfyExtension(value: unknown): value is ComfyExtension {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string'
  )
}

async function loadGuardedCoreExtension<
  Name extends string,
  Extension extends ComfyExtension
>(
  importExtension: () => Promise<Partial<Record<Name, Extension>> | undefined>,
  exportName: Name,
  errorType: string,
  surface: Surface
): Promise<Extension | undefined> {
  let module: Partial<Record<Name, Extension>> | undefined
  try {
    module = await importExtension()
  } catch (cause) {
    const error = new Error(`Failed to load module for ${exportName}`, {
      cause
    })
    if (__DISTRIBUTION__ !== 'cloud') throw error
    reportError(error, { surface, errorType })
    return undefined
  }

  const extension =
    module !== undefined && Object.hasOwn(module, exportName)
      ? module[exportName]
      : undefined

  if (!isNamedComfyExtension(extension)) {
    const error = new TypeError(`${exportName} did not load from its module`)
    if (__DISTRIBUTION__ !== 'cloud') throw error
    reportError(error, { surface, errorType })
    return undefined
  }

  return extension as Extension
}

function wireSessionCookieLogoutFallback(): () => void {
  const { onUserLogout } = useCurrentUser()
  return onUserLogout(() => {
    clearOAuthRequestId()
    void useSessionCookie().deleteSession()
  })
}

async function loadAgentPanelExtension() {
  const agentPanelModule: unknown = await import('./agentPanel')
  const registerAgentPanelExtension =
    typeof agentPanelModule === 'object' &&
    agentPanelModule !== null &&
    'registerAgentPanelExtension' in agentPanelModule
      ? agentPanelModule.registerAgentPanelExtension
      : undefined

  if (typeof registerAgentPanelExtension !== 'function') {
    const error = new TypeError(
      'Agent panel extension module did not provide a registration function'
    )
    if (__DISTRIBUTION__ !== 'cloud') throw error
    reportError(error, {
      surface: 'agent',
      errorType: 'error_loading_agent_panel_extension'
    })
    return
  }

  registerAgentPanelExtension()
}

async function registerInOrder() {
  baseCoreExtensions.forEach(register)

  if (!isCloud) {
    register((await import('./nodeTemplates')).nodeTemplatesExtension)
  }

  await registerElectronAdapterExtension()

  if (__DISTRIBUTION__ === 'cloud') {
    const cloudRemoteConfig = await loadGuardedCoreExtension(
      () => import('./cloudRemoteConfig'),
      'cloudRemoteConfigExtension',
      'error_loading_cloud_remote_config_extension',
      'platform'
    )
    if (cloudRemoteConfig) register(cloudRemoteConfig)

    const cloudBadges = await loadGuardedCoreExtension(
      () => import('./cloudBadges'),
      'cloudBadgesExtension',
      'error_loading_cloud_badges_extension',
      'platform'
    )
    if (cloudBadges) register(cloudBadges)

    const cloudSessionCookie = await loadGuardedCoreExtension(
      () => import('./cloudSessionCookie'),
      'cloudSessionCookieExtension',
      'error_loading_cloud_session_cookie_extension',
      'auth'
    )
    if (cloudSessionCookie) {
      register(cloudSessionCookie)
    } else {
      disposers.push(wireSessionCookieLogoutFallback())
    }
  }

  await loadAgentPanelExtension()

  if (isCloud || isNightly) {
    const feedbackButton = await loadGuardedCoreExtension(
      () => import('./cloudFeedbackTopbarButton'),
      'feedbackButtonExtension',
      'error_loading_feedback_button_extension',
      'workspace'
    )
    if (feedbackButton) register(feedbackButton)
  }
}

/**
 * Registers the core extensions in their fixed order. Later calls return the
 * first call's promise.
 */
export function registerCoreExtensions(): Promise<void> {
  registration ??= registerInOrder()
  return registration
}

import.meta.hot?.dispose(() => disposers.forEach((dispose) => dispose()))
