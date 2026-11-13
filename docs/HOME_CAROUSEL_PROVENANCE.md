# Disabled homepage template provenance

The homepage workflow experiment measures eligible people whose featured workflow
executes successfully within 24 hours of a qualified exposure. Clicks are secondary.
Execution success does not establish usable media or first-ever use.

The preparation gate `isTemplateOriginEnabled()` returns false. There is no flag,
environment override, persistent storage, analytics event or live activation here.
In an explicitly enabled Cloud fixture, the builtin-template loader associates the
exact loaded workflow instance with a public template ID and SHA-256 of the JSON
serialization of its prepared graph snapshot, taken before graph loading. This
revision identifies that snapshot, not a Git commit or the raw download. Other
sources and other workflow instances do not inherit it. Asynchronous hashing uses
a per-instance generation guard; hash failures omit the claim and never fail loading.

Queueing freezes the claim before prompt construction and withholds it if the
active workflow or its origin changes during the await. The API projects only
`template_id` and `revision` into `extra_data.homepage_template_origin`. No account,
email, URL, exposure token or consent assertion is added. A claim is not enrollment,
consent, proof of loading, or server verification.

Cloud must remove the claim and verify exact execution content against a trusted,
versioned catalog and a server-side account/consent eligibility check before
persisting provenance on the accepted job. Both server dependencies remain absent.
The verifier defaults to an exact execution-prompt digest. Cloud also supports a
bounded, explicit catalog policy for seed or prompt/text fields on exact node IDs
and classes; it preserves every other input, model and graph connection. No real
mutable-input rules or catalog entries are supplied. Unknown input policies fail
closed. This proves content equivalence under the approved input policy, not the
client's historical loading action.

Activation needs an approved eligible template pool, real snapshot/execution digest
pairs, applicable consent and canonical-account adapters, revocation-aware analysis,
and a server-job success reconciliation. A rollout must remain off until those are
reviewed. Existing website PR #428 remains the separate disabled exposure/order
preparation; this branch neither enables it nor alters carousel visuals.
