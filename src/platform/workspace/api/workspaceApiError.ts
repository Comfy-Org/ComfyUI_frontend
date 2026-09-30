/**
 * A leaf module, so a subclass can be declared wherever the class is needed
 * without pulling the workspace client and its stores into the import graph.
 */
export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'WorkspaceApiError'
  }
}
