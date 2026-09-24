export class NodeIdSpaceExhaustedError extends Error {
  constructor(message: string = 'Node ID space exhausted', cause?: Error) {
    super(message, { cause })
    this.name = 'NodeIdSpaceExhaustedError'
  }
}
