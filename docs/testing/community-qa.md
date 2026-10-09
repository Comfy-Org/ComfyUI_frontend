# Cloud 2 Community QA

The bottom sidebar Community button opens Custom node packs and Community
workflows. Pack cards, revision details, pinning, and account authoring reuse
the Cloud registry. Workflow cards use the same card layout and expose tags,
use cases, model references, pack references, complexity and structural
variants. Selecting a workflow opens its details. Open original graph verifies
its SHA256 and passes the untouched file to the normal graph loader.
Facet menus show up to 50 matches at once and search the complete available
list. Their search input stays within the modal's popover focus scope; typing
a facet query does not change the workflow search field.

Future static bundles can also provide a sibling `workflow.cloud.json` using
HARVEY's `cloud-reference-adaptation-v1` extension. Open Cloud-adapted graph is
an explicit second choice. Loading checks the immutable original binding,
both byte digests, each original/replacement JSON pointer, duplicate paths,
duplicate JSON properties, and that only ledger changes occurred. Numeric
values are compared without JavaScript rounding. The original remains
available for Magic Patch regression. Adaptation does not certify rendering.
Verification observations and blocked references remain inspectable.

The default workflow source is the existing authenticated workflow-library
API, including when `VITE_COMMUNITY_WORKFLOW_SOURCE` is unset. Set it to
`static` explicitly to select HARVEY's isolated QA list. Static assets are
separate from the frontend build and stay out of git and the public asset
directory. Pack tags use the separately prepared private index selected by
the server-only `COMMUNITY_CORPUS_DIR` setting in either workflow mode.
The existing service contract serves originals only; adapted loading currently
uses the static provider. The frozen 411 release contains no adapted graphs.

For an expanded bundle, prepare and verify it in a separate directory, then
merge it with the frozen assets without replacing overlapping source metadata:

```sh
pnpm exec tsx scripts/community/merge-corpora.ts \
  temp/community-corpus temp/community-expanded-admitted temp/community-union
```

The first input wins every overlapping graph identity. Detail files, original
graphs and source metadata are copied byte for byte into a new directory;
input directories remain unchanged. Both inputs and the complete output are
validated. The collected expanded release contains 2,997 workflows, with 124
overlaps and 2,873 new originals: 3,284 collected across both releases.
Native import validation admits 2,989 expanded records. Eight new records are
blocked by existing limits (four metadata-size, three prompt-size, one
model-name-size), giving a 3,276-workflow prepared union. Their complete graph
and source metadata files remain retained with exclusion receipts. These are
import constraints, not render results. Expanded AI descriptions are unreviewed
observations; pending descriptions and unsupported nodes remain included.
Select `temp/community-union` as `COMMUNITY_CORPUS_DIR` only after preparation
and validation pass. The live application rollout is separate.

The original expanded archive is retained with SHA256
`bdad967c042399f38ee8bcfe2466dc79c7b22a318b86a4995a1b93a70030a59a`.
Its 78,482,983-byte ancillary `catalog.jsonl` exceeds the native 8 MiB member
limit and pushes the archive over its 256 MiB expanded-size bound. A separate
sealed derivative omits that catalog and the eight blocked records, retaining
all 5,978 admitted graph/source payloads byte for byte. No service limits or
source records are changed. Native prompt/model-name limits count UTF-8 bytes
(16,000 / 2,000), while metadata is bounded to 262,144 bytes. The derivative
archive and manifest pins plus every exclusion are recorded in
`community-admission-derivation.json` in the QA handoff.

The admitted expanded derivative can be prepared from the same Cloud checkout:

```sh
go run "$FRONTEND/scripts/community/prepare-corpus.go" \
  -bundle "$HANDOFF/temp/human-qa-expanded-admissible-20261008.zip" \
  -sha256 6c2df3787332fb2bf1a581121a4b00af7e483e07077f28fa1841f8da422ec352 \
  -manifest-sha256 d38aa9f7d936c22897b068d72af76dfc04e1bdb9d7d177e196dc0e0d83d6f346 \
  -output "$FRONTEND/temp/community-expanded-admitted"
```

Set `HANDOFF` to a newly extracted handoff directory and `FRONTEND` to the
current frontend checkout. The prepared union is also included directly at
`temp/community-union`; validate it with `verify-corpus.ts` before serving.

The separate r3 corpus snapshot contains prepared assets, exclusions, validation/lineage
receipts and source-tool changes. It does not contain a frontend `dist` to
replace the live successor. Apply Community UI changes to the current frontend
source before deployment. Importing the admitted expanded bundle must skip all
124 existing identities to preserve their original metadata; 2,865 admitted
graphs are new. No execution or model-availability verification is inferred.
Its source-tool patch is a delta from the r2 handoff and contains only the
merge/verification tools, their tests, and this runbook. It does not contain
the earlier Community UI patch. Extract the handoff into a new directory and
review the delta against the current frontend source before applying it.

The r4 UI handoff instead contains a complete source patch based on frontend
`92e534bc20c0b2b1422ceebd5bbb9475c037685f`, with Community navigation, both
workflow providers, facet menus, adaptation validation and corpus tools. Apply
that patch only to its declared base or review a source merge. It includes no
frontend `dist` or duplicate corpus payloads. The public frontend is unchanged;
activation must coordinate the existing PRIMARY restart with JERRY.

To prepare the reviewed 411-workflow bundle, run this from JERRY's Cloud
checkout containing `services/ingest/workflowlibrary`, with Go 1.26.4:

```sh
mkdir -p "$FRONTEND/temp"
go run "$FRONTEND/scripts/community/prepare-corpus.go" \
  -bundle /home/benjc/popbot/sent_files/human-qa-real-20261008.zip \
  -sha256 c94f162afa9867954e69fad5e99535f70bac01fcd04daea0774ea3683ecb672e \
  -manifest-sha256 7d5951f4f3e61be70fb2b0f42181dfb00a20a70b11cc70772ba73f590884b4b1 \
  -output "$FRONTEND/temp/community-corpus"
```

The preparer uses the existing lossless bundle reader, metadata normalizer and
validator. It requires a new output directory and validates the entire archive
before writing. Original graph bytes and original source metadata remain
unchanged. Unsupported workflows remain included; model references and imported
tags do not imply execution verification. Fourteen descriptions are pending.
The preparer copies declared adapted files only after checking their binding
and byte digest. Always run the verifier below before serving a new bundle;
it also checks the complete change ledger against both graph files.

From the frontend checkout:

```sh
pnpm exec tsx scripts/community/verify-corpus.ts "$HANDOFF/temp/community-union"
COMMUNITY_CORPUS_DIR="$HANDOFF/temp/community-union" \
VITE_COMMUNITY_WORKFLOW_SOURCE=static VITE_LOCAL_CLOUD_AUTH=true \
DEV_SERVER_COMFYUI_URL=http://127.0.0.1:5175 DISTRIBUTION=cloud \
  pnpm dev --host 127.0.0.1 --port 5192 --strictPort
```

Keep `HANDOFF` outside the Vite workspace and public directory. Confirm that
raw filesystem URLs cannot serve corpus files anonymously; the isolated
candidate returned 403 for the original index's `/@fs/` URL. Vite documents
its workspace restriction in [server.fs.allow](https://vite.dev/config/server-options.html#server-fs-allow).
The local-auth flag exposes the existing development API-key form; server
authentication still verifies the account. Use `VITE_COMMUNITY_WORKFLOW_SOURCE=service`
to retain the live backend collection while testing the new Community navigation.
The current public site's 411 records are unchanged.

The QA middleware serves only index/detail/original/adapted JSON paths beneath
`/api/community-corpus`. It forwards the caller's authentication to the configured
backend's workflow-library collections endpoint before serving every asset. Anonymous requests
receive 401. Existing backend authorization failures are retained. It runs in
Vite dev and preview; deployments must provide the same authenticated asset
route, or select the workflow-library service. It is never copied into `dist`.

For a production frontend build, restore the baseline's expected sibling
`ComfyUI_secure_nodes/frontend/src` directory for its existing public symlink,
then run `pnpm build:cloud`. This UI does not change those runtime assets.

Suggested review split: Community navigation and reused browser components;
static QA provider, authenticated asset serving and corpus preparation;
explicit adapted-graph loading, change-ledger validation and producer fixtures.

Validation includes Community, registry, creator, library and sidebar tests,
a 5,000-option facet regression, HTTP authorization/path checks, and complete
schema/hash validation of the 3,276 prepared assets. Real Chromium fixture-form
sessions pass both the 411-entry service and 3,276-entry static transports:
pack search/tag selection, 24-entry workflow pages, search/tag/details, unchanged
graph while browsing, one exact original fetch on Open, and missing-node diagnostics.
No render, installation, download or draft requests were submitted; fixture
palette memberships stayed unchanged. These are UI and contract checks. Runtime
rendering, Ben's production-token acceptance and Magic Patch integration remain
separate. Existing settings/userdata/template/view failures are retained in the
browser receipts; the first QA run also records an omitted development login flag.

The producer adaptation fixture under
`src/platform/community/fixtures/cloud-reference-v1` is synthetic, uses a fake
model hash and unknown node, and is retained only for tests. It is excluded
from the live 411 collection. It must not be rendered or used to fetch weights.
