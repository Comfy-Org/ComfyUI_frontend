export interface Asset {
  id: string
  name: string
  filename: string
  file_type?: string
  file_size?: number
  preview_url?: string
  tags: string[]
  metadata?: {
    description?: string
    author?: string
    model_type?: string
    base_model?: string
  }
}

export interface AssetBrowserDialogOptions {
  nodeType?: string
  widgetName?: string
  currentValue?: string
  onSelect?: (asset: Asset) => void
}
