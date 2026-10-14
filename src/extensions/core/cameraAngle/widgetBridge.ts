import { clampState, roundState } from './cameraAngleMath'
import {
  CAMERA_ANGLE_VIEW_MODES,
  CAMERA_ANGLE_VIEW_WIDGET_NAME,
  CAMERA_ANGLE_WIDGET_NAMES,
  DEFAULT_CAMERA_ANGLE_STATE
} from './types'
import type {
  CameraAngleField,
  CameraAngleState,
  CameraAngleViewMode
} from './types'

export interface WidgetLike {
  name: string
  value: unknown
}

export interface NodeWithWidgets {
  widgets?: WidgetLike[]
}

const FIELDS = Object.keys(CAMERA_ANGLE_WIDGET_NAMES) as CameraAngleField[]

function widgetByName(
  node: NodeWithWidgets,
  name: string
): WidgetLike | undefined {
  return node.widgets?.find((w) => w.name === name)
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function readStateFromWidgets(node: NodeWithWidgets): CameraAngleState {
  const state = { ...DEFAULT_CAMERA_ANGLE_STATE }
  for (const field of FIELDS) {
    state[field] = numberOr(
      widgetByName(node, CAMERA_ANGLE_WIDGET_NAMES[field])?.value,
      DEFAULT_CAMERA_ANGLE_STATE[field]
    )
  }
  return clampState(state)
}

export function writeStateToWidgets(
  node: NodeWithWidgets,
  state: CameraAngleState
): void {
  const rounded = roundState(state)
  for (const field of FIELDS) {
    const widget = widgetByName(node, CAMERA_ANGLE_WIDGET_NAMES[field])
    if (!widget || widget.value === rounded[field]) continue
    widget.value = rounded[field]
  }
}

export function isViewMode(value: unknown): value is CameraAngleViewMode {
  return (
    typeof value === 'string' &&
    (CAMERA_ANGLE_VIEW_MODES as readonly string[]).includes(value)
  )
}

export function readViewMode(node: NodeWithWidgets): CameraAngleViewMode {
  const value = widgetByName(node, CAMERA_ANGLE_VIEW_WIDGET_NAME)?.value
  return isViewMode(value) ? value : 'camera'
}

export function writeViewMode(
  node: NodeWithWidgets,
  mode: CameraAngleViewMode
): void {
  const widget = widgetByName(node, CAMERA_ANGLE_VIEW_WIDGET_NAME)
  if (widget && widget.value !== mode) widget.value = mode
}
