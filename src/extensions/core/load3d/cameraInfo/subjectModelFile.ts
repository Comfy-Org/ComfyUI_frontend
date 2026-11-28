import { LOAD3D_NONE_MODEL } from '@comfyorg/viewport3d/load3d/constants'
import type { SubjectModelSource } from '@comfyorg/viewport3d/cameraInfo/subjectModel'

import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { resolveWidgetInputSource } from '@/composables/widgetInputSource'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'

const MESH_INPUT = 'mesh'
const MODEL_3D_INPUT = 'model_3d'
const MODEL_FILE_WIDGET = 'model_file'
const COMPONENTS_NODE_TYPE = 'Get3DComponents'

function modelFileOf(node: LGraphNode): string | undefined {
  const value = node.widgets?.find((w) => w.name === MODEL_FILE_WIDGET)?.value
  return typeof value === 'string' && value && value !== LOAD3D_NONE_MODEL
    ? value
    : undefined
}

function inputSource(
  node: LGraphNode,
  inputName: string,
  renderedNodeId: NodeId
): LGraphNode | undefined {
  const slot = node.findInputSlot(inputName)
  return slot < 0
    ? undefined
    : resolveWidgetInputSource(node, slot, renderedNodeId)
}

export function resolveSubjectModelFile(
  node: LGraphNode,
  renderedNodeId: NodeId
): string | undefined {
  const components = inputSource(node, MESH_INPUT, renderedNodeId)
  if (components?.type !== COMPONENTS_NODE_TYPE) return undefined
  const loader = inputSource(components, MODEL_3D_INPUT, renderedNodeId)
  return loader && modelFileOf(loader)
}

export function toSubjectModelSource(modelFile: string): SubjectModelSource {
  const { filepath, rootFolder } = parseAnnotatedPath(modelFile, 'input')
  const [subfolder, filename] = Load3dUtils.splitFilePath(filepath)
  return { rootFolder, subfolder, filename }
}
