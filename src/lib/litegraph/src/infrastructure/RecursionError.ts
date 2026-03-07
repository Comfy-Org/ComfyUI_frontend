export class RecursionError extends Error {
  constructor(message: string = 'Circular reference detected.', cause?: Error) {
    super(message, { cause })
    this.name = 'RecursionError'
  }
}
