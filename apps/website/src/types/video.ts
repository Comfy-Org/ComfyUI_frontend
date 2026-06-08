export interface VideoTrack {
  src: string
  kind: 'subtitles' | 'captions' | 'descriptions'
  srclang: string
  label: string
}
