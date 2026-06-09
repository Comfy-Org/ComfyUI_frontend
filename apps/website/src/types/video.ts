export interface VideoTrack {
  kind: 'subtitles' | 'captions' | 'descriptions'
  label: string
  src: string
  srclang: string
}
