import { reactive } from 'vue'

import { api } from '@/scripts/api'

import { UserFile } from '../stores/userFileStore'

export type ModelUsageLog = Record<string, number>

interface FileMetadata {
  modified: number
  size: number
  created: number
}

export class ComfyModelLog extends UserFile {
  static readonly dir = 'models'
  static readonly filename = 'models_usage.json'
  static readonly filePath = `${ComfyModelLog.dir}/${ComfyModelLog.filename}`

  private _isModified = false
  private _isLoaded = false
  public activeState: ModelUsageLog

  constructor(metadata: FileMetadata, content: string = '{}') {
    super(
      ComfyModelLog.filePath,
      metadata.modified,
      metadata.size,
      metadata.created
    )
    this.activeState = reactive(this.parseContent(content))
  }

  private parseContent(content: string): ModelUsageLog {
    try {
      const parsed = JSON.parse(content)
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  }

  override get isModified(): boolean {
    return this._isModified
  }

  override set isModified(value: boolean) {
    this._isModified = value
  }

  override get isLoaded(): boolean {
    return this._isLoaded
  }

  override set isLoaded(value: boolean) {
    this._isLoaded = value
  }

  // Method to update usage log
  updateModelUsage(modelKey: string, timestamp: number = Date.now()) {
    this.activeState[modelKey] = timestamp
    this._isModified = true
  }

  override async save(): Promise<UserFile> {
    if (!this._isModified) return this
    this.content = JSON.stringify(this.activeState)
    const result = await super.save({ force: true })
    this._isModified = false
    return result
  }

  private static async getFileMetadata(): Promise<FileMetadata> {
    const defaultMetadata: FileMetadata = {
      modified: Date.now(),
      size: 0,
      created: Date.now()
    }

    try {
      const dirMetadata = await api.listUserDataFullInfo(ComfyModelLog.dir)
      const fileMetadata = dirMetadata.find(
        (item) => item.path === ComfyModelLog.filename
      )

      if (fileMetadata) {
        return {
          modified: fileMetadata.modified,
          size: fileMetadata.size,
          created: fileMetadata.created
        }
      }
    } catch {
      // Use default metadata if API call fails
    }

    return defaultMetadata
  }

  private static async getFileContent(): Promise<string> {
    try {
      const response = await api.getUserData(ComfyModelLog.filePath)
      return response.status === 200 ? await response.text() : '{}'
    } catch {
      return '{}'
    }
  }

  static async fromAPI(): Promise<ComfyModelLog> {
    // Check if already loading to prevent duplicate API calls
    if (this._loadingPromise) {
      return this._loadingPromise
    }

    this._loadingPromise = this._doLoad()
    try {
      return await this._loadingPromise
    } finally {
      this._loadingPromise = null
    }
  }

  private static _loadingPromise: Promise<ComfyModelLog> | null = null

  private static async _doLoad(): Promise<ComfyModelLog> {
    const [metadata, content] = await Promise.all([
      ComfyModelLog.getFileMetadata(),
      ComfyModelLog.getFileContent()
    ])

    return new ComfyModelLog(metadata, content)
  }
}
