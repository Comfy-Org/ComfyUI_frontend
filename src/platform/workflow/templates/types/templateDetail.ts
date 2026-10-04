interface TemplateDetailRow {
  id: string
  name: string
  description: string
}

export interface TemplateDetailGroup {
  id: string
  label: string
  total?: string
  rows: readonly TemplateDetailRow[]
}
