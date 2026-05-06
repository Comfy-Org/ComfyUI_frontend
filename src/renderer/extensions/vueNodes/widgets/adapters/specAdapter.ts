import type { Component } from 'vue'

import type { ResultItemType } from '@/schemas/apiSchema'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { AssetKind } from '@/types/widgetTypes'

export interface SpecAdapterProps {
  assetKind?: AssetKind
  allowUpload?: boolean
  uploadFolder?: ResultItemType
  uploadSubfolder?: string
}

export interface SpecAdapter<T extends InputSpec> {
  canHandle: (spec: InputSpec) => spec is T
  extractProps: (spec: T) => SpecAdapterProps
  component?: Component
}
