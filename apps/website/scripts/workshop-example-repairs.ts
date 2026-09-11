import { z } from 'astro/zod'

import rawRepairs from '../src/data/workshop-example-repairs.json'
import type { WorkshopDisplayEntry } from '../src/content/workshop-display.schema'

const source = z
  .object({
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
    repairs: z.array(
      z.object({
        id: z.string().min(1),
        exampleTitle: z.string().min(1),
        sampleUrl: z.string().min(1),
        values: z.record(z.string(), z.json())
      })
    )
  })
  .parse(rawRepairs)
const repairs = new Map(source.repairs.map((repair) => [repair.id, repair]))
if (repairs.size !== source.repairs.length)
  throw new Error('Duplicate example repair IDs')

export function repairWorkshopExamples(
  entries: WorkshopDisplayEntry[]
): WorkshopDisplayEntry[] {
  return entries.map((entry) => {
    const repair = repairs.get(entry.id)
    if (!repair) return entry
    return {
      ...entry,
      examples: entry.examples.map((example, index) =>
        example.title === repair.exampleTitle &&
        entry.media.samples?.[index]?.url === repair.sampleUrl &&
        Object.keys(example.values).length === 0
          ? { ...example, values: structuredClone(repair.values) }
          : example
      )
    }
  })
}
