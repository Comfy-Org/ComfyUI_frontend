export interface DownscaleRequest {
  readonly id: number
  readonly source: string
  readonly maxEdge: number
}

export interface DownscaleResponse {
  readonly id: number
  readonly result:
    | {
        readonly originalSize: {
          readonly width: number
          readonly height: number
        }
        readonly blob?: Blob
      }
    | undefined
}
