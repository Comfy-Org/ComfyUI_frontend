/**
 * Factory interface for creating audio widgets
 * Provides consistent API for both Vue and LiteGraph implementations
 */
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export interface WidgetCreationResult {
  widget: IBaseWidget
  minWidth?: number
  minHeight?: number
}

export interface AudioWidgetFactory {
  /**
   * Creates an AUDIO_UI widget for audio playback/preview
   */
  createAudioUI(node: LGraphNode, inputName: string): WidgetCreationResult

  /**
   * Creates an AUDIOUPLOAD widget for file uploads
   */
  createAudioUpload(node: LGraphNode, inputName: string): WidgetCreationResult

  /**
   * Creates an AUDIO_RECORD widget for audio recording
   */
  createAudioRecord(node: LGraphNode, inputName: string): WidgetCreationResult

  /**
   * Hook called before registering node definitions
   */
  beforeRegisterNodeDef?(nodeType: any, nodeData: any): void

  /**
   * Hook called when node outputs are updated
   */
  onNodeOutputsUpdated?(nodeOutputs: Record<string, any>): void

  /**
   * Hook called when a node is created (for RecordAudio setup)
   */
  onNodeCreated?(node: LGraphNode): Promise<void>
}
