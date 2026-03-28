# FakerJS Evaluation

## Seed Stability
- Are outputs identical across runs with same seed? **Partially** — all fields except `faker.date.recent()` are identical. Date-based generators use `new Date()` as a reference point, so they shift between runs even with the same seed.
- Do other fields change when schema changes? **Yes** — inserting a new faker call before existing calls shifts the PRNG sequence, causing all downstream fields to produce different values. This is the single-stream RNG problem.

## Schema Mutation Test Results

Adding a field (`author: faker.person.fullName()`) before `type` in a 5-record array:
- Record 0: `name` and `size` stable, `type` changed
- Records 1–4: `name`, `size`, and `type` all changed

This confirms that faker uses a single global PRNG stream. Any insertion/deletion of a faker call shifts all subsequent outputs.

## Pros
- Rich API for realistic test data (names, files, paths, numbers, lorem text)
- Seeded output is deterministic within a single schema version (non-date fields)
- Good for generating bulk data (e.g., 50 items for infinite scroll testing)
- Lightweight, well-maintained, no native dependencies
- Already available via pnpm catalog

## Cons
- **Schema fragility**: Adding, removing, or reordering faker calls in a generator shifts all downstream values. This will invalidate screenshot goldens whenever fixture schemas change.
- **Date instability**: `faker.date.recent()`, `faker.date.past()`, etc. use wall-clock time as a reference, making them non-deterministic even with a seed. Must use `faker.date.between()` with fixed boundaries instead.
- **No per-field isolation**: Unlike property-based testing libraries, faker has a single PRNG stream. There is no built-in way to isolate individual fields from schema changes.
- **Mitigation complexity**: Workarounds exist (per-record re-seeding, `faker.seed(baseIndex + i)` per item) but add boilerplate and reduce readability.

## Recommendation
- **Use** for generating bulk test data in unit/integration tests where screenshot stability is not required (e.g., testing infinite scroll behavior, list rendering, search/filter logic).
- **Do not use** for screenshot/golden-image test fixtures — schema changes will cascade into visual diffs. For those, prefer hand-crafted or static JSON fixtures.
- **If adopted**, establish these conventions:
  1. Always use `faker.date.between({ from: '2024-01-01', to: '2024-12-31' })` instead of `faker.date.recent()`.
  2. Consider per-record seeding (`faker.seed(BASE_SEED + index)`) to isolate records from each other when schema stability matters.
  3. Pin the `@faker-js/faker` major version to avoid cross-version PRNG changes.
