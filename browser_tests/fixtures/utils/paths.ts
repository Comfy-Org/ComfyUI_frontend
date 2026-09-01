export function assetPath(fileName: string): string {
  return `./browser_tests/assets/${fileName}`
}

export function metadataFixturePath(fileName: string): string {
  return `./src/scripts/metadata/__fixtures__/${fileName}`
}
