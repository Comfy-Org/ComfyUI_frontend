import { isCloud, isNightly } from '@/platform/distribution/types'
import { useExtensionService } from '@/platform/extensions/services/extensionService'
import type { ComfyExtension } from '@/types/comfy'
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
import { maskEditorExtension } from './maskeditor'
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

/**
 * Loads a cloud-only extension module and returns its named export, or
 * `undefined` if a suppressed `vite:preloadError` resolved the import to
 * something without that export. Outside cloud this throws instead, so a
 * malformed module still fails fast in desktop/localhost/dev builds.
 */
async function loadGuardedCoreExtension(
  importExtension: () => Promise<unknown>,
  exportName: string,
  errorType: string
): Promise<ComfyExtension | undefined> {
  const module: unknown = await importExtension()
  const extension =
    typeof module === 'object' && module !== null && exportName in module
      ? (module as Record<string, unknown>)[exportName]
      : undefined

  if (extension === undefined) {
    const error = new TypeError(`${exportName} did not load from its module`)
    if (__DISTRIBUTION__ !== 'cloud') throw error
    reportError(error, { surface: 'agent', errorType })
    return undefined
  }

  return extension as ComfyExtension
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
      'error_loading_cloud_remote_config_extension'
    )
    if (cloudRemoteConfig) register(cloudRemoteConfig)

    const cloudBadges = await loadGuardedCoreExtension(
      () => import('./cloudBadges'),
      'cloudBadgesExtension',
      'error_loading_cloud_badges_extension'
    )
    if (cloudBadges) register(cloudBadges)

    const cloudSessionCookie = await loadGuardedCoreExtension(
      () => import('./cloudSessionCookie'),
      'cloudSessionCookieExtension',
      'error_loading_cloud_session_cookie_extension'
    )
    if (cloudSessionCookie) register(cloudSessionCookie)
  }

  await loadAgentPanelExtension()

  if (isCloud || isNightly) {
    const feedbackButton = await loadGuardedCoreExtension(
      () => import('./cloudFeedbackTopbarButton'),
      'feedbackButtonExtension',
      'error_loading_feedback_button_extension'
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
