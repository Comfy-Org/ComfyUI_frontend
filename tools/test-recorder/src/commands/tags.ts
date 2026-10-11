import { TAG_REGISTRY } from '../tags'

export function runTags(): void {
  const tagWidth = Math.max(...TAG_REGISTRY.map(({ tag }) => tag.length))
  const hintWidth = Math.max(...TAG_REGISTRY.map(({ hint }) => hint.length))

  for (const { tag, hint, description } of TAG_REGISTRY) {
    console.log(
      `  ${tag.padEnd(tagWidth)}  ${hint.padEnd(hintWidth)}  ${description}`
    )
  }
}
