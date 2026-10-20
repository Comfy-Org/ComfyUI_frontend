export interface AgencyWorkItem {
  id: string
  title: string
  alt: string
  type: 'video' | 'image'
  src?: string
  videoName?: string
  baseUrl?: string
  width?: number
  poster?: string
  sourceUrl: string
  reviewNote?: string
}

export interface AgencyDraft {
  id: string
  name: string
  specialty: string
  specialties: readonly string[]
  background: string
  logoSrc?: string
  logoMaskSize?: string
  logoMaskPosition?: string
  logoMaskMode?: 'alpha' | 'luminance'
  reviewHref: string
  contactHref?: string
  contactSource?: string
  work: readonly AgencyWorkItem[]
}

export interface AgencyDraftLabels {
  program: string
  explore: string
  roster: string
  about: string
  work: string
  pendingWork: string
  pendingLogo: string
  contact: string
  pendingContact: string
  contactTitle: string
  back: string
  profile: string
  source: string
}
