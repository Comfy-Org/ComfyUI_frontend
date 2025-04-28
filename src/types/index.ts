import type {
  DeviceStats,
  EmbeddingsResponse,
  ExtensionsResponse,
  LogEntry,
  LogsRawResponse,
  NodeError,
  PromptResponse,
  Settings,
  SystemStats,
  TerminalSize,
  User,
  UserData,
  UserDataFullInfo
} from '@/schemas/apiSchema'
import { ComfyApp } from '@/scripts/app'

import type {
  BottomPanelExtension,
  CommandManager,
  ExtensionManager,
  SidebarTabExtension,
  ToastManager,
  ToastMessageOptions
} from './extensionTypes'

export type { ComfyExtension } from './comfy'
export type { ComfyApi } from '@/scripts/api'
export type { ComfyApp } from '@/scripts/app'
export type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
export type { InputSpec } from '@/schemas/nodeDefSchema'
export type {
  EmbeddingsResponse,
  ExtensionsResponse,
  PromptResponse,
  NodeError,
  Settings,
  DeviceStats,
  SystemStats,
  User,
  UserData,
  UserDataFullInfo,
  TerminalSize,
  LogEntry,
  LogsRawResponse
}
export type {
  SidebarTabExtension,
  BottomPanelExtension,
  ToastManager,
  ExtensionManager,
  CommandManager,
  ToastMessageOptions
}

declare global {
  const app: ComfyApp
}
