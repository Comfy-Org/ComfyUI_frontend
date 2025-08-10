import Fuse from 'fuse.js'

import type { ComfyCommandImpl } from '@/stores/commandStore'

export interface CommandSearchOptions {
  limit?: number
}

export class CommandSearchService {
  private fuse: Fuse<ComfyCommandImpl>
  private commands: ComfyCommandImpl[]

  constructor(commands: ComfyCommandImpl[]) {
    this.commands = commands
    this.fuse = new Fuse(commands, {
      keys: [
        { name: 'label', weight: 2 },
        { name: 'id', weight: 1 }
      ],
      includeScore: true,
      threshold: 0.4,
      shouldSort: true,
      minMatchCharLength: 1
    })
  }

  public updateCommands(commands: ComfyCommandImpl[]) {
    this.commands = commands
    const options = {
      keys: [
        { name: 'label', weight: 2 },
        { name: 'id', weight: 1 }
      ],
      includeScore: true,
      threshold: 0.4,
      shouldSort: true,
      minMatchCharLength: 1
    }
    this.fuse = new Fuse(commands, options)
  }

  public searchCommands(
    query: string,
    options?: CommandSearchOptions
  ): ComfyCommandImpl[] {
    // Remove the leading ">" if present
    const searchQuery = query.startsWith('>') ? query.slice(1).trim() : query

    // If empty query, return all commands sorted alphabetically by label
    if (!searchQuery) {
      const sortedCommands = [...this.commands].sort((a, b) => {
        const labelA = a.label || a.id
        const labelB = b.label || b.id
        return labelA.localeCompare(labelB)
      })
      return options?.limit
        ? sortedCommands.slice(0, options.limit)
        : sortedCommands
    }

    const results = this.fuse.search(searchQuery)
    const commands = results.map((result) => result.item)

    return options?.limit ? commands.slice(0, options.limit) : commands
  }
}
