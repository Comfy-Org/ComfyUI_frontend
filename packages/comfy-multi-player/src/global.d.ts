export {};

declare global {
  /**
   * Ambient fallback for `structuredClone`.
   *
   * Node has provided this as a native global since v17, and every
   * evergreen browser has it too, so this never changes runtime behavior.
   * The *type* declaration, though, is only pulled in by TypeScript when
   * `lib` includes `"DOM"`/`"WebWorker"`, or by a recent enough `@types/node`
   * (the `web-globals` module it shipped starting in late 2022 releases).
   * A consumer's toolchain that resolves an older `@types/node` and has no
   * DOM lib hits `TS2304: Cannot find name 'structuredClone'` across this
   * package's source (`applier.ts`, `project.ts`, `mint.ts`, `compact.ts`,
   * `doc.ts`) even though the function is present at runtime. Declaring it
   * here removes that dependency on the consumer's resolved types entirely.
   */
  function structuredClone<T = any>(value: T, options?: { transfer?: readonly unknown[] }): T;
}
