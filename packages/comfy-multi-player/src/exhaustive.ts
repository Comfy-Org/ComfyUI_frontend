/**
 * Compile-time exhaustiveness guards (issue #21).
 *
 * Every site that switches on a closed vocabulary — the op kinds of {@link
 * import("./types.js").Op} and the widget-storage strategies of schema §1.2 —
 * ends in a `default:` arm that passes the narrowed value to one of these
 * helpers. Once every member has its own `case`, TypeScript narrows the value
 * to `never` and the call type-checks; the moment a member is added to the
 * union and not handled here, the argument is no longer `never` and `tsc`
 * fails AT THAT SITE.
 *
 * The parameter type is `never` on purpose and is never widened to `any` or
 * `unknown`: a helper that accepts `unknown` compiles forever and enforces
 * nothing, which is the vacuous version of this whole idea.
 *
 * Two helpers, because the two failure modes differ:
 *
 * - {@link assertNever} — the site cannot continue. Throws. Use where an
 *   unhandled member has no meaningful behaviour (applying an op the applier
 *   has no handler for).
 * - {@link checkExhaustive} — compile-time only, no runtime effect. Use where
 *   the site already has a deliberate, documented tolerant fallback for values
 *   that arrive over the wire from another implementation, and changing that
 *   fallback to a throw would be a behavioural change rather than a
 *   type-safety one. The compile-time force is identical; only the runtime
 *   contract differs.
 */

/**
 * Fail compilation if `value` is not `never`, and throw if this is somehow
 * reached at runtime (an unknown member arriving from an untyped caller or a
 * peer implementation).
 */
export function assertNever(value: never, context: string): never {
  throw new Error(`${context}: unhandled variant ${JSON.stringify(value as unknown)}`);
}

/**
 * Fail compilation if `value` is not `never`. Does nothing at runtime, so the
 * enclosing site keeps whatever documented fallback it already had for a
 * member this build does not know about.
 */
export function checkExhaustive(_value: never): void {
  /* compile-time only — see the module doc comment */
}
