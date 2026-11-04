import type { PromptWorkflowMetadata } from '@comfyorg/comfyui-api-types'

type AssertTrue<T extends true> = T

/**
 * Ties the hand-written `workflow_metadata` wire members to core's OpenAPI
 * without putting the generated type in this package's published surface.
 *
 * `StampedWorkflowId.workflow_id` in `./executionTypes` cannot reference
 * `PromptWorkflowMetadata` directly: those frame interfaces are re-exported
 * from `@comfyorg/comfyui-frontend-types`, and `@comfyorg/comfyui-api-types` is
 * a private workspace package that an external consumer of the published
 * declarations cannot resolve (`pnpm check:types-consumer`). Declaring the
 * member as `string` keeps the published contract resolvable; this assertion
 * keeps it honest, failing the build if core ever retypes the map's values away
 * from `string` instead of letting the frontend adopt the change silently.
 *
 * Deleting the member from the spec fails earlier, in this package's own alias.
 */
export type WorkflowMetadataValuesAreStrings = AssertTrue<
  [PromptWorkflowMetadata[string]] extends [string] ? true : false
>
