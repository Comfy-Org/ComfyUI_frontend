/** Node types a deployment lacks, under their pack, or null if none is known. */
export interface MissingBuildPack {
  packId: string | null
  nodeTypes: readonly string[]
  /** Set when the Build has the pack but its release cannot load it. */
  loadFailure?: { cause: string }
}

/** A model a deployment lacks, with its models/ folder and download link. */
export interface MissingBuildModel {
  name: string
  directory: string | null
  url?: string
}
