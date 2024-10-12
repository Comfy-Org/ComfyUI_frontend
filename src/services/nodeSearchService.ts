// @ts-strict-ignore
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import Fuse, { IFuseOptions, FuseSearchOptions } from 'fuse.js'
import _ from 'lodash'

export type SearchAuxScore = number[]

interface ExtraSearchOptions {
  matchWildcards?: boolean
}

export class FuseSearch<T> {
  private fuse: Fuse<T>
  private readonly keys: string[]
  public readonly data: T[]
  public readonly advancedScoring: boolean

  constructor(
    data: T[],
    options?: IFuseOptions<T>,
    createIndex: boolean = true,
    advancedScoring: boolean = false
  ) {
    this.data = data
    this.keys = (options.keys ?? []) as string[]
    this.advancedScoring = advancedScoring
    const index =
      createIndex && options?.keys
        ? Fuse.createIndex(options.keys, data)
        : undefined
    this.fuse = new Fuse(data, options, index)
  }

  public search(query: string, options?: FuseSearchOptions): T[] {
    const fuseResult = !query
      ? this.data.map((x) => ({ item: x, score: 0 }))
      : this.fuse.search(query, options)

    if (!this.advancedScoring) {
      return fuseResult.map((x) => x.item)
    }

    const aux = fuseResult
      .map((x) => ({
        item: x.item,
        scores: this.calcAuxScores(query.toLocaleLowerCase(), x.item, x.score)
      }))
      .sort((a, b) => this.compareAux(a.scores, b.scores))

    return aux.map((x) => x.item)
  }

  public calcAuxScores(query: string, entry: T, score: number): SearchAuxScore {
    let values: string[] = []
    if (!this.keys.length) values = [entry as string]
    else values = this.keys.map((x) => entry[x])
    const scores = values.map((x) => this.calcAuxSingle(query, x, score))
    let result = scores.sort(this.compareAux)[0]

    const deprecated = values.some((x) =>
      x.toLocaleLowerCase().includes('deprecated')
    )
    result[0] += deprecated && result[0] != 0 ? 5 : 0
    if (entry['postProcessSearchScores']) {
      result = entry['postProcessSearchScores'](result) as SearchAuxScore
    }
    return result
  }

  public calcAuxSingle(
    query: string,
    item: string,
    score: number
  ): SearchAuxScore {
    const itemWords = item
      .split(/ |\b|(?<=[a-z])(?=[A-Z])|(?=[A-Z][a-z])/)
      .map((x) => x.toLocaleLowerCase())
    const queryParts = query.split(' ')
    item = item.toLocaleLowerCase()

    let main = 9
    let aux1 = 0
    let aux2 = 0

    if (item == query) {
      main = 0
    } else if (item.startsWith(query)) {
      main = 1
      aux2 = item.length
    } else if (itemWords.includes(query)) {
      main = 2
      aux1 = item.indexOf(query) + item.length * 0.5
      aux2 = item.length
    } else if (item.includes(query)) {
      main = 3
      aux1 = item.indexOf(query) + item.length * 0.5
      aux2 = item.length
    } else if (queryParts.every((x) => itemWords.includes(x))) {
      const indexes = queryParts.map((x) => itemWords.indexOf(x))
      const min = Math.min(...indexes)
      const max = Math.max(...indexes)
      main = 4
      aux1 = max - min + max * 0.5 + item.length * 0.5
      aux2 = item.length
    } else if (queryParts.every((x) => item.includes(x))) {
      const min = Math.min(...queryParts.map((x) => item.indexOf(x)))
      const max = Math.max(...queryParts.map((x) => item.indexOf(x) + x.length))
      main = 5
      aux1 = max - min + max * 0.5 + item.length * 0.5
      aux2 = item.length
    }

    const lengthPenalty =
      0.2 *
      (1 -
        Math.min(item.length, query.length) /
          Math.max(item.length, query.length))
    return [main, aux1, aux2, score + lengthPenalty]
  }

  public compareAux(a: SearchAuxScore, b: SearchAuxScore) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        return a[i] - b[i]
      }
    }
    return a.length - b.length
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

  public matches(
    node: ComfyNodeDefImpl,
    value: FilterOptionT,
    extraOptions?: ExtraSearchOptions
  ): boolean {
    const matchWildcards = extraOptions?.matchWildcards !== false
    if (matchWildcards && value === '*') {
      return true
    }
    const options = this.getNodeOptions(node)
    return (
      options.includes(value) ||
      (matchWildcards && _.some(options, (option) => option === '*'))
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
    return [node.nodeSource.displayText]
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
    this.nodeFuseSearch = new FuseSearch(
      data,
      {
        keys: ['name', 'display_name'],
        includeScore: true,
        threshold: 0.3,
        shouldSort: false,
        useExtendedSearch: true
      },
      true,
      true
    )

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
    options?: FuseSearchOptions,
    extraOptions?: ExtraSearchOptions
  ): ComfyNodeDefImpl[] {
    const matchedNodes = this.nodeFuseSearch.search(query)

    const results = matchedNodes.filter((node) => {
      return _.every(filters, (filterAndValue) => {
        const [filter, value] = filterAndValue
        return filter.matches(node, value, extraOptions)
      })
    })

    return options?.limit ? results.slice(0, options.limit) : results
  }

  public getFilterById(id: string): NodeFilter<string> | undefined {
    return this.nodeFilters.find((filter) => filter.id === id)
  }
}
