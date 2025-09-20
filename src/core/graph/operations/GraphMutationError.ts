export class GraphMutationError extends Error {
  public readonly code: string
  public readonly context: Record<string, any>

  constructor(
    message: string,
    context: Record<string, any>,
    code = 'GRAPH_MUTATION_ERROR'
  ) {
    super(message)
    this.code = code
    this.context = context
  }
}
