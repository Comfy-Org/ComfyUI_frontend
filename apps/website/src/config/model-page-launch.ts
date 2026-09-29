// Typed `boolean` so it can't narrow to `false` and make the lookups it gates look dead.
// Flipping it also writes a markdown twin per model page into the section indexes and
// llms-full.txt; model pages have server-rendered content only once FE-2942 (#18899) lands.
export const MODEL_PAGES_INDEXABLE: boolean = false
