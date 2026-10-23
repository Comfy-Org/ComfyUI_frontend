import { defineAsyncComponent } from 'vue'
import type { Component } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { isViewMode } from '@/extensions/core/load3d/cameraAngle/widgetBridge'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { reportLoadModelOutcome } from '@/extensions/core/load3d/reportLoadModelOutcome'
import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IStringWidget } from '@/lib/litegraph/src/types/widgets'
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { api } from '@/scripts/api'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { CustomComfyWidgetConstructor } from '@/types/comfy'
import { CAMERA_ANGLE_VIEW_WIDGET_NAME } from '@comfyorg/viewport3d/cameraAngle/types'
import type { CameraAngleViewMode } from '@comfyorg/viewport3d/cameraAngle/types'
import {
  LOAD3D_NONE_MODEL,
  SUPPORTED_EXTENSIONS_ACCEPT
} from '@comfyorg/viewport3d/load3d/constants'

const Load3D = defineAsyncComponent(
  () => import('@/extensions/core/load3d/components/Load3D.vue')
)
const Load3DAdvanced = defineAsyncComponent(
  () => import('@/extensions/core/load3d/components/Load3DAdvanced.vue')
)
const CameraInfo = defineAsyncComponent(
  () => import('@/extensions/core/load3d/components/cameraInfo/CameraInfo.vue')
)
const CameraAngle = defineAsyncComponent(
  () =>
    import('@/extensions/core/load3d/components/cameraAngle/CameraAngle.vue')
)

const VIEWPORT_STATE_NODES = new Set([
  'Preview3DAdvanced',
  'Save3DAdvanced',
  'PreviewGaussianSplat',
  'PreviewPointCloud',
  'SaveGaussianSplat',
  'SavePointCloud'
])

function resourceSubfolder(node: LGraphNode) {
  const resourceFolder = String(node.properties['Resource Folder'] ?? '').trim()
  return resourceFolder ? `3d/${resourceFolder}` : '3d'
}

async function handleModelUpload(files: FileList, node: LGraphNode) {
  if (!files.length) return

  const modelWidget = node.widgets?.find((w) => w.name === 'model_file') as
    | IStringWidget
    | undefined

  try {
    const uploadPath = await Load3dUtils.uploadFile(
      files[0],
      resourceSubfolder(node)
    )

    if (!uploadPath) {
      useToast().warning(t('toastMessages.fileUploadFailed'))
      return
    }

    const modelUrl = api.apiURL(
      Load3dUtils.getResourceURL(
        ...Load3dUtils.splitFilePath(uploadPath),
        'input'
      )
    )

    const { useLoad3d, markLoad3dSceneDirty } =
      await import('@/extensions/core/load3d/composables/useLoad3d')

    useLoad3d(node).waitForLoad3d(async (load3d) => {
      try {
        reportLoadModelOutcome(await load3d.loadModel(modelUrl))
      } catch {
        useToast().warning(t('toastMessages.failedToLoadModel'))
      }
    })

    if (modelWidget) {
      if (!modelWidget.options.values?.includes(uploadPath)) {
        modelWidget.options.values?.push(uploadPath)
      }

      modelWidget.value = uploadPath
    }

    markLoad3dSceneDirty(node)
  } catch (error) {
    console.error('Model upload failed:', error)
    useToast().warning(t('toastMessages.fileUploadFailed'))
  }
}

async function handleResourcesUpload(files: FileList, node: LGraphNode) {
  if (!files.length) return

  try {
    await Load3dUtils.uploadMultipleFiles(files, resourceSubfolder(node))
    const { markLoad3dSceneDirty } =
      await import('@/extensions/core/load3d/composables/useLoad3d')
    markLoad3dSceneDirty(node)
  } catch (error) {
    console.error('Extra resources upload failed:', error)
    useToast().warning(t('toastMessages.extraResourcesUploadFailed'))
  }
}

async function clearModel(node: LGraphNode) {
  try {
    const { markLoad3dSceneDirty } =
      await import('@/extensions/core/load3d/composables/useLoad3d')
    const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
    if (modelWidget) modelWidget.value = LOAD3D_NONE_MODEL
    markLoad3dSceneDirty(node)
  } catch (error) {
    reportError(error, {
      errorType: 'error_loading_3d_extensions',
      surface: 'graph'
    })
  }
}

function createFileInput(accept: string, multiple: boolean): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.style.display = 'none'
  return input
}

function addModelFileButtons(node: LGraphNode) {
  const fileInput = createFileInput(SUPPORTED_EXTENSIONS_ACCEPT, false)
  node.properties['Resource Folder'] = ''
  fileInput.onchange = async () => {
    await handleModelUpload(fileInput.files!, node)
  }
  node.addWidget('button', 'upload 3d model', 'upload3dmodel', () => {
    fileInput.click()
  })

  const resourcesInput = createFileInput('*', true)
  resourcesInput.onchange = async () => {
    await handleResourcesUpload(resourcesInput.files!, node)
    resourcesInput.value = ''
  }
  node.addWidget(
    'button',
    'upload extra resources',
    'uploadExtraResources',
    () => {
      resourcesInput.click()
    }
  )

  node.addWidget('button', 'clear', 'clear', () => {
    void clearModel(node)
  })
}

function addViewportWidget(
  node: LGraphNode,
  component: Component,
  inputSpec: CustomInputSpec,
  type: string
) {
  const widget = new ComponentWidgetImpl({
    node,
    name: inputSpec.name,
    component,
    inputSpec,
    options: { hideInPanel: true }
  })
  widget.type = type
  addWidget(node, widget)
  return { widget }
}

/** Widget constructors for the 3D node types, available before the 3D extensions load. */
export const load3dWidgets: Record<string, CustomComfyWidgetConstructor> = {
  LOAD_3D(node) {
    const { comfyClass } = node.constructor
    const name =
      comfyClass && VIEWPORT_STATE_NODES.has(comfyClass)
        ? 'viewport_state'
        : 'image'
    if (node.widgets?.some((w) => w.name === 'model_file'))
      addModelFileButtons(node)
    return addViewportWidget(
      node,
      Load3D,
      { name, type: 'Load3D', isPreview: false },
      'load3D'
    )
  },

  PREVIEW_3D(node) {
    return addViewportWidget(
      node,
      Load3D,
      { name: 'image', type: 'Preview3D', isPreview: true },
      'load3D'
    )
  },

  LOAD_3D_ADVANCED(node) {
    return addViewportWidget(
      node,
      Load3DAdvanced,
      { name: 'viewport_state', type: 'LOAD_3D_ADVANCED', isPreview: false },
      'load3DAdvanced'
    )
  },

  CAMERA_INFO_STATE(node) {
    const widget = new ComponentWidgetImpl({
      node,
      name: 'camera_info_state',
      component: CameraInfo,
      inputSpec: {
        name: 'camera_info_state',
        type: 'CAMERA_INFO_STATE',
        isPreview: false
      },
      options: { serialize: false, hideInPanel: true }
    })
    widget.type = 'cameraInfo'
    widget.serialize = false
    addWidget(node, widget)
    return { widget }
  },

  CAMERA_ANGLE_VIEW(node) {
    let viewMode: CameraAngleViewMode = 'camera'
    const widget = new ComponentWidgetImpl<string | object>({
      node,
      name: CAMERA_ANGLE_VIEW_WIDGET_NAME,
      component: CameraAngle,
      inputSpec: {
        name: CAMERA_ANGLE_VIEW_WIDGET_NAME,
        type: 'CAMERA_ANGLE_VIEW',
        isPreview: false
      },
      options: {
        serialize: false,
        hideInPanel: true,
        getValue: () => viewMode,
        setValue: (value) => {
          if (isViewMode(value)) viewMode = value
        }
      }
    })
    widget.type = 'cameraAngle'
    addWidget(node, widget)
    return { widget }
  }
}
