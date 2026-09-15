# Error handling review

Apply this profile to changes in op validation, dispatch, rejection, and the apply loop. It protects the fail-closed and "rejected op leaves the doc untouched" guarantees (KA-4, KA-11) and abort-remainder semantics (vocabulary §4).

- Reject silent swallowing: an error caught and replaced with a success-looking return hides a failed apply. Malformed, unknown, deferred, and semantically invalid ops must be rejected loudly as `OpRejectedError` with a specific `code`, never degraded into a no-op that reports success.
- Verify fail-closed, not fail-open: unreadable schema versions, uncatalogued widget classes, and untrusted node input must be rejected, not best-effort projected (KA-11, KA-12). A new fail-open path is a correctness issue.
- Guard mutate-before-throw: a rejection thrown after a Yjs mutation has already happened leaves the document partially mutated, because a throwing `doc.transact` body does not roll back, and the `op_id` ledger write is skipped so the op is also non-idempotent (this is the live shape of issue #10). Any new dispatch path that can mutate and then throw is a critical finding; require validate-before-mutate.
- Preserve abort-remainder: when one op in a batch is rejected, the remainder must not apply. Do not add a path that continues applying trailing ops after a rejection.
- Do not demand error handling on genuinely infallible pure code, and do not flag existing handling in untouched code. Focus on NEW or CHANGED error paths. Critical for swallowed or partial-mutation errors in the apply path; major for a new fail-open branch; minor for a missing rejection `code` specificity.

## Machine-consumed copy

The `src/**` `path_instructions` entry is an umbrella over every profile, so it is hosted by
[`README.md`](README.md#the-machine-consumed-copy-coderabbityaml) rather than owned by one. Its one
load-bearing sentence is this profile's mutate-before-throw rule, so the anchor for it lives here: if
the generated block loses that requirement, CI fails rather than the bot quietly stopping to ask for
it. The needle is space-free because the YAML carries it in a folded scalar. That block's content was
moved byte-for-byte from a hand-written config and has **not** been audited — it still cites issue
#10 as open, and #10 is closed; see
[#80](https://github.com/Comfy-Org/comfy-multi-player/issues/80).

<!-- claim: validate-before-mutate :: .coderabbit.yaml -->

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
