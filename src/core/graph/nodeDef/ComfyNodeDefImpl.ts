import { cloneDeep, uniq } from 'es-toolkit/compat'

import { resolveNodeDefText } from '@/i18n'
import {
  collectSearchableInputTypes,
  collectSearchableOutputTypes
} from '@/schemas/nodeDef/searchableSlotTypes'
import { transformNodeDefV1ToV2 } from '@/schemas/nodeDef/migration'
import type {
  ComfyNodeDef as ComfyNodeDefV2,
  InputSpec as InputSpecV2,
  OutputSpec as OutputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  ComfyInputsSpec as ComfyInputSpecV1,
  ComfyNodeDef as ComfyNodeDefV1,
  ComfyOutputTypesSpec as ComfyOutputSpecV1,
  PriceBadge
} from '@/schemas/nodeDefSchema'
import { NODE_TO_ESSENTIALS_CATEGORY } from '@/constants/essentialsNodes'
import { useNodeFrequencyStore } from '@/stores/nodeFrequencyStore'
import { CORE_NODE_MODULES, getNodeSource } from '@/types/nodeSource'
import type { NodeSource } from '@/types/nodeSource'
import type { FuseSearchable, SearchAuxScore } from '@/utils/fuseUtil'

export class ComfyNodeDefImpl
  implements ComfyNodeDefV1, ComfyNodeDefV2, FuseSearchable
{
  // ComfyNodeDef fields (V1)
  readonly name: string
  /**
   * Category is not marked as readonly as the bookmark system
   * needs to write to it to assign a node to a custom folder.
   */
  category: string
  readonly main_category?: string
  readonly python_module: string
  readonly help: string
  readonly deprecated: boolean
  readonly experimental: boolean
  readonly dev_only: boolean
  readonly output_node: boolean
  readonly api_node: boolean
  /**
   * @deprecated Use `inputs` instead
   */
  readonly input: ComfyInputSpecV1
  /**
   * @deprecated Use `outputs` instead
   */
  readonly output: ComfyOutputSpecV1
  /**
   * @deprecated Use `outputs[n].is_list` instead
   */
  readonly output_is_list?: boolean[]
  /**
   * @deprecated Use `outputs[n].name` instead
   */
  readonly output_name?: string[]
  /**
   * @deprecated Use `outputs[n].tooltip` instead
   */
  readonly output_tooltips?: string[]
  /**
   * Order of inputs for each category (required, optional, hidden)
   */
  readonly input_order?: Record<string, string[]>
  /**
   * Price badge definition for API nodes.
   * Contains a JSONata expression to calculate pricing based on widget values
   * and input connectivity.
   */
  readonly price_badge?: PriceBadge
  /**
   * Alternative names for search. Useful for synonyms, abbreviations,
   * or old names after renaming a node.
   */
  readonly search_aliases?: string[]
  /** Category for the Essentials tab. If set, the node appears in Essentials. */
  readonly essentials_category?: string
  /** Whether the blueprint is a global/installed blueprint (not user-created). */
  readonly isGlobal?: boolean
  readonly isCoreNode: boolean

  // V2 fields
  readonly inputs: Record<string, InputSpecV2>
  readonly outputs: OutputSpecV2[]
  readonly hidden?: Record<string, boolean>

  // ComfyNodeDefImpl fields
  readonly nodeSource: NodeSource
  readonly inputTypes: string[]
  readonly outputTypes: string[]

  /**
   * Raw `/object_info` text, kept unresolved so `display_name` and
   * `description` can be resolved against the active locale on every read.
   * Declared with TypeScript `private` rather than `#private`: Vue wraps store
   * instances in a Proxy, and `#private` reads throw through one.
   */
  private readonly backendDisplayName?: string
  private readonly backendDescription?: string

  /**
   * @internal
   * Migrate default input options to forceInput.
   */
  private static _migrateDefaultInput(nodeDef: ComfyNodeDefV1): ComfyNodeDefV1 {
    const def = cloneDeep(nodeDef)
    def.input ??= {}
    // For required inputs, now we have the input socket always present. Specifying
    // it now has no effect.
    for (const [name, spec] of Object.entries(def.input.required ?? {})) {
      const inputOptions = spec[1]
      if (inputOptions && inputOptions.defaultInput) {
        console.warn(
          `Use of defaultInput on required input ${nodeDef.python_module}:${nodeDef.name}:${name} is deprecated. Please drop the defaultInput option.`
        )
      }
    }
    // For optional inputs, defaultInput is used to distinguish the null state.
    // We migrate it to forceInput. One example is the "seed_override" input usage.
    // User can connect the socket to override the seed.
    for (const [name, spec] of Object.entries(def.input.optional ?? {})) {
      const inputOptions = spec[1]
      if (inputOptions && inputOptions.defaultInput) {
        console.warn(
          `Use of defaultInput on optional input ${nodeDef.python_module}:${nodeDef.name}:${name} is deprecated. Please use forceInput instead.`
        )
        inputOptions.forceInput = true
      }
    }
    return def
  }

  constructor(def: ComfyNodeDefV1) {
    const obj = ComfyNodeDefImpl._migrateDefaultInput(def)

    /**
     * Copy fields that are declared on this class but not explicitly assigned
     * below (e.g. `search_aliases`) straight from the source definition.
     * `display_name` and `description` are held out: they are accessors with no
     * setter, so assigning them here would throw.
     */
    const { display_name, description, ...assignable } = obj
    Object.assign(this, assignable)

    // Initialize V1 fields
    this.name = obj.name
    this.backendDisplayName = display_name || undefined
    this.backendDescription = description || undefined
    this.category = obj.category
    this.main_category = obj.main_category
    this.python_module = obj.python_module
    this.help = obj.help ?? ''
    this.deprecated = obj.deprecated ?? obj.category === ''
    this.experimental =
      obj.experimental ?? obj.category.startsWith('_for_testing')
    this.dev_only = obj.dev_only ?? false
    this.output_node = obj.output_node
    this.api_node = !!obj.api_node
    this.input = obj.input ?? {}
    this.output = obj.output ?? []
    this.output_is_list = obj.output_is_list
    this.output_name = obj.output_name
    this.output_tooltips = obj.output_tooltips
    this.input_order = obj.input_order
    this.price_badge = obj.price_badge
    this.essentials_category =
      NODE_TO_ESSENTIALS_CATEGORY[obj.name] ?? obj.essentials_category
    this.isGlobal = obj.isGlobal
    this.isCoreNode = CORE_NODE_MODULES.includes(
      this.python_module.split('.')[0]
    )

    // Initialize V2 fields
    const defV2 = transformNodeDefV1ToV2(obj)
    this.inputs = defV2.inputs
    this.outputs = defV2.outputs
    this.hidden = defV2.hidden

    // Initialize node source
    this.nodeSource = getNodeSource(obj.python_module, this.essentials_category)
    this.inputTypes = uniq(
      Object.values(this.inputs).flatMap(collectSearchableInputTypes)
    )
    this.outputTypes = uniq(
      collectSearchableOutputTypes(
        this.outputs,
        this.inputs,
        obj.output_matchtypes
      )
    )
  }

  /**
   * Resolved against the active locale on read, so a locale switch retitles
   * every def without refetching `/object_info`.
   */
  get display_name(): string {
    return resolveNodeDefText(
      'display_name',
      this.name,
      this.backendDisplayName
    )
  }

  get description(): string {
    return resolveNodeDefText('description', this.name, this.backendDescription)
  }

  get nodePath(): string {
    return (this.category ? this.category + '/' : '') + this.name
  }

  get isDummyFolder(): boolean {
    return this.name === ''
  }

  postProcessSearchScores(scores: SearchAuxScore): SearchAuxScore {
    const nodeFrequencyStore = useNodeFrequencyStore()
    const nodeFrequency = nodeFrequencyStore.getNodeFrequencyByName(this.name)
    return [scores[0], -nodeFrequency, ...scores.slice(1)]
  }

  get nodeLifeCycleBadgeText(): string {
    if (this.deprecated) return '[DEPR]'
    if (this.experimental) return '[BETA]'
    if (this.dev_only) return '[DEV]'
    return ''
  }
}
