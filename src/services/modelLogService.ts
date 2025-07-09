import { UserFile } from '../stores/userFileStore'

export type ModelUsageLog = Record<string, number>

export class ComfyModelLog extends UserFile {
  static readonly filePath = 'models/models_usage.json'

  constructor(options: { modified: number; size: number; created: number }) {
    super(
      ComfyModelLog.filePath,
      options.modified,
      options.size,
      options.created
    )
  }

  _isModified = false
  _isLoaded = false
  activeState: ModelUsageLog = {}
  override get isModified(): boolean {
    return this._isModified
  }

  override set isModified(value: boolean) {
    this._isModified = value
  }

  override set isLoaded(value: boolean) {
    this._isLoaded = value
  }

  override get isLoaded(): boolean {
    return this._isLoaded
  }

  async get(): Promise<ModelUsageLog> {
    if (this.isLoaded) {
      return this.activeState
    }
    if (this.isLoading) {
      return this.activeState
    }
    // not loaded, so load the content
    try {
      await this.load({ force: true })
      this.activeState = JSON.parse(this.content || '{}') as ModelUsageLog
      this.isLoaded = true
    } catch (e) {
      this.activeState = {}
      this.isLoaded = true
    }
    return this.activeState
  }

  override async save() {
    this.content = JSON.stringify(this.activeState)
    const ret = await super.save({ force: true })
    this.isModified = false
    return ret
  }
}
