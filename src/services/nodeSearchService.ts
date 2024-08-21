import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { getNodeSource } from '@/types/nodeSource'
import Fuse, { IFuseOptions, FuseSearchOptions } from 'fuse.js'
import _ from 'lodash'

export class FuseSearch<T> {
  private fuse: Fuse<T>
  public readonly data: T[]

  constructor(
    data: T[],
    options?: IFuseOptions<T>,
    createIndex: boolean = true
  ) {
    this.data = data
    const index =
      createIndex && options?.keys
        ? Fuse.createIndex(options.keys, data)
        : undefined
    this.fuse = new Fuse(data, options, index)
  }

  public search(query: string, options?: FuseSearchOptions): T[] {
    if (!query || query === '') {
      return [...this.data]
    }
    return this.fuse.search(query, options).map((result) => result.item)
  }
}

export type FilterAndValue<T = string> = [NodeFilter<T>, T]

export abstract class NodeFilter<FilterOptionT = string> {
  public abstract readonly id: string
  public abstract readonly name: string
  public abstract readonly invokeSequence: string
  public abstract readonly longInvokeSequence: string
  public readonly fuseSearch: FuseSearch<FilterOptionT>

  constructor(
    nodeDefs: ComfyNodeDefImpl[],
    options?: IFuseOptions<FilterOptionT>
  ) {
    this.fuseSearch = new FuseSearch(this.getAllNodeOptions(nodeDefs), options)
  }

  private getAllNodeOptions(nodeDefs: ComfyNodeDefImpl[]): FilterOptionT[] {
    return [
      ...new Set(
        nodeDefs.reduce((acc, nodeDef) => {
          return [...acc, ...this.getNodeOptions(nodeDef)]
        }, [])
      )
    ]
  }

  public abstract getNodeOptions(node: ComfyNodeDefImpl): FilterOptionT[]

  public matches(node: ComfyNodeDefImpl, value: FilterOptionT): boolean {
    if (value === '*') {
      return true
    }
    const options = this.getNodeOptions(node)
    return (
      options.includes(value) || _.some(options, (option) => option === '*')
    )
  }
}

export class InputTypeFilter extends NodeFilter<string> {
  public readonly id: string = 'input'
  public readonly name = 'Input Type'
  public readonly invokeSequence = 'i'
  public readonly longInvokeSequence = 'input'

  public override getNodeOptions(node: ComfyNodeDefImpl): string[] {
    return node.input.all.map((input) => input.type)
  }
}

export class OutputTypeFilter extends NodeFilter<string> {
  public readonly id: string = 'output'
  public readonly name = 'Output Type'
  public readonly invokeSequence = 'o'
  public readonly longInvokeSequence = 'output'

  public override getNodeOptions(node: ComfyNodeDefImpl): string[] {
    return node.output.all.map((output) => output.type)
  }
}

export class NodeSourceFilter extends NodeFilter<string> {
  public readonly id: string = 'source'
  public readonly name = 'Source'
  public readonly invokeSequence = 's'
  public readonly longInvokeSequence = 'source'

  public override getNodeOptions(node: ComfyNodeDefImpl): string[] {
    return [getNodeSource(node.python_module).displayText]
  }
}

export class NodeCategoryFilter extends NodeFilter<string> {
  public readonly id: string = 'category'
  public readonly name = 'Category'
  public readonly invokeSequence = 'c'
  public readonly longInvokeSequence = 'category'

  public override getNodeOptions(node: ComfyNodeDefImpl): string[] {
    return [node.category]
  }
}

export class NodeSearchService {
  public readonly nodeFuseSearch: FuseSearch<ComfyNodeDefImpl>
  public readonly nodeFilters: NodeFilter<string>[]

  constructor(data: ComfyNodeDefImpl[]) {
    this.nodeFuseSearch = new FuseSearch(data, {
      keys: ['name', 'display_name'],
      includeScore: true,
      threshold: 0.3,
      shouldSort: true,
      useExtendedSearch: true
    })

    const filterSearchOptions = {
      includeScore: true,
      threshold: 0.3,
      shouldSort: true
    }

    this.nodeFilters = [
      new InputTypeFilter(data, filterSearchOptions),
      new OutputTypeFilter(data, filterSearchOptions),
      new NodeCategoryFilter(data, filterSearchOptions)
    ]

    if (data[0].python_module !== undefined) {
      this.nodeFilters.push(new NodeSourceFilter(data, filterSearchOptions))
    }
  }

  public endsWithFilterStartSequence(query: string): boolean {
    return query.endsWith(':')
  }

  public searchNode(
    query: string,
    filters: FilterAndValue<string>[] = [],
    options?: FuseSearchOptions
  ): ComfyNodeDefImpl[] {
    const matchedNodes = this.nodeFuseSearch.search(query)

    const results = matchedNodes.filter((node) => {
      return _.every(filters, (filterAndValue) => {
        const [filter, value] = filterAndValue
        return filter.matches(node, value)
      })
    })

    return options?.limit ? results.slice(0, options.limit) : results
  }

  public getFilterById(id: string): NodeFilter<string> | undefined {
    return this.nodeFilters.find((filter) => filter.id === id)
  }
}
