export class RecursionError extends Error {
  constructor(subject: string) {
    super(subject)
    this.name = 'RecursionError'
  }
}
