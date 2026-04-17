export interface BlockConfig {
  type: 'paragraph' | 'list'
}

export interface SectionConfig {
  id: string
  hasTitle?: boolean
  blocks: BlockConfig[]
}
