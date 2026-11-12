export interface DownscaleRequest {
  readonly id: number
  readonly maxEdge: number
  readonly source: string
}

export interface DownscaleResponse {
  readonly id: number
  readonly result:
    | {
        readonly originalSize: {
          readonly height: number
          readonly width: number
        }
        readonly blob?: Blob
      }
    | undefined
}
