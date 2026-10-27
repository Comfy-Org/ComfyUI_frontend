import { isCloud, isNightly } from '@/platform/distribution/types'
import { useExtensionService } from '@/services/extensionService'
import type { ComfyExtension } from '@/types/comfy'

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

async function registerInOrder() {
  baseCoreExtensions.forEach(register)

  if (!isCloud) {
    register((await import('./nodeTemplates')).nodeTemplatesExtension)
  }

  await registerElectronAdapterExtension()

  if (__DISTRIBUTION__ === 'cloud') {
    register((await import('./cloudRemoteConfig')).cloudRemoteConfigExtension)
    register((await import('./cloudBadges')).cloudBadgesExtension)
    register((await import('./cloudSessionCookie')).cloudSessionCookieExtension)
  }

  const { registerAgentPanelExtension } = await import('./agentPanel')
  registerAgentPanelExtension()

  if (isCloud || isNightly) {
    register(
      (await import('./cloudFeedbackTopbarButton')).feedbackButtonExtension
    )
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
