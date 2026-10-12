#!/usr/bin/env node

// Called only after the workflow's full gates. npm owns Sigstore verification;
// decoded claims are usable only in its successful, matching verified record.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { isDeepStrictEqual } from "node:util";

const registry = "https://registry.npmjs.org/";
const repository = "Comfy-Org/ComfyUI_frontend";
const repositoryUrl = `https://github.com/${repository}`;
const workflowPath = ".github/workflows/publish-comfy-multi-player.yaml";
const tagPrefix = "comfy-multi-player-v";
const provenanceType = "https://slsa.dev/provenance/v1";

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function command(program, args, cwd = process.cwd(), allowFailure = false) {
  const result = spawnSync(program, args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  requireThat(!result.error && result.status !== null, `${program} could not complete`);
  requireThat(allowFailure || result.status === 0, `${program} ${args[0]} exited ${result.status}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function requireIdentity(value, expected, label) {
  requireThat(value?.name === expected.name && value?.version === expected.version, `${label}: package name/version conflict`);
}

function requireRemoteTag(ref, sha) {
  const raw = command("git", ["ls-remote", "--exit-code", `${repositoryUrl}.git`, ref, `${ref}^{}`]).stdout.trim();
  const refs = new Map();
  for (const line of raw.split("\n")) {
    const [commit, name, extra] = line.split("\t");
    requireThat(/^[a-f0-9]{40}$/.test(commit) && [ref, `${ref}^{}`].includes(name) && !extra && !refs.has(name), "malformed remote tag response");
    refs.set(name, commit);
  }
  requireThat(refs.has(ref) && (refs.get(`${ref}^{}`) ?? refs.get(ref)) === sha, "remote tag does not resolve to GITHUB_SHA");
}

function releaseExists(tag) {
  const result = command("gh", ["api", "--hostname", "github.com", "--include", `repos/${repository}/releases/tags/${encodeURIComponent(tag)}`], process.cwd(), true);
  const response = /^HTTP\/\S+ (\d{3})[^\n]*\r?\n[\s\S]*?\r?\n\r?\n([\s\S]*)$/.exec(result.stdout);
  requireThat(response, "missing GitHub release HTTP response");
  const value = JSON.parse(response[2]);
  if (result.status === 1 && response[1] === "404" && value?.message === "Not Found") return false;
  requireThat(result.status === 0 && response[1] === "200", "GitHub release lookup failed (not a definitive 404)");
  requireThat(value?.tag_name === tag && value?.draft === false, "existing GitHub release has a different tag or is not published");
  return true;
}

function download(url, path) {
  // No redirects: registry metadata cannot redirect this probe to another host.
  return command("curl", ["--silent", "--show-error", "--proto", "=https", "--connect-timeout", "30", "--max-time", "180", "--output", path, "--write-out", "%{http_code}", url]).stdout;
}

function tarIdentity(path, expected) {
  const manifest = JSON.parse(command("tar", ["-xOzf", path, "package/package.json"]).stdout);
  requireIdentity(manifest, expected, "tarball");
  return manifest;
}

// The workspace manifest exports source and uses catalog: specifiers; only a
// pnpm-rewritten manifest is publishable.
function requirePublishManifest(manifest, expected) {
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    requireThat(Object.values(manifest[field] ?? {}).every((spec) => typeof spec === "string" && !/^(catalog|workspace):/.test(spec)),
      `tarball ${field} contain unresolved workspace specifiers`);
  }
  requireThat(isDeepStrictEqual(manifest.exports, expected.publishConfig.exports),
    "tarball exports do not match publishConfig.exports");
}

function sha512(path) {
  return createHash("sha512").update(readFileSync(path)).digest();
}

function requireProvenance(audit, expected, digest, ref, sha) {
  requireThat(Array.isArray(audit?.invalid) && audit.invalid.length === 0 &&
    Array.isArray(audit?.missing) && audit.missing.length === 0 && Array.isArray(audit?.verified),
  "audit did not return clean, verified attestation output");
  const records = audit.verified.filter((record) => record?.name === expected.name && record?.version === expected.version &&
    record?.registry === registry && record?.location === `node_modules/${expected.name}`);
  requireThat(records.length === 1, "missing unique verified package record");
  const bundles = records[0].attestationBundles;
  requireThat(Array.isArray(bundles), "missing verified attestation bundles");
  const provenance = bundles.filter((entry) => entry?.predicateType === provenanceType);
  requireThat(provenance.length === 1, "missing unique verified SLSA provenance bundle");
  const envelope = provenance[0].bundle?.dsseEnvelope;
  requireThat(envelope?.payloadType === "application/vnd.in-toto+json" && typeof envelope.payload === "string", "malformed verified DSSE envelope");
  const statement = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));
  requireThat(statement?._type === "https://in-toto.io/Statement/v1" && statement?.predicateType === provenanceType, "unexpected provenance statement type");
  // npm's purl encoding preserves the namespace slash, but escapes @.
  const subjectName = `pkg:npm/${expected.name.replaceAll("@", "%40")}@${expected.version}`;
  requireThat(Array.isArray(statement.subject) && statement.subject.length === 1 &&
    statement.subject[0]?.name === subjectName && statement.subject[0]?.digest?.sha512 === digest.toString("hex"),
  "provenance subject name/digest conflict");
  const definition = statement.predicate?.buildDefinition;
  const workflow = definition?.externalParameters?.workflow;
  requireThat(definition?.buildType === "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1" &&
    workflow?.repository === repositoryUrl && workflow?.path === workflowPath && workflow?.ref === ref,
  "provenance repository/workflow/ref conflict");
  const sources = definition.resolvedDependencies?.filter((source) => source?.uri === `git+${repositoryUrl}@${ref}`);
  requireThat(Array.isArray(sources) && sources.length === 1 && sources[0]?.digest?.gitCommit === sha,
    "provenance source URI/commit conflict");
}

function verifyExisting(metadata, expected, digest, dir, ref, sha) {
  requireIdentity(metadata, expected, "registry");
  const integrity = `sha512-${digest.toString("base64")}`;
  requireThat(metadata.dist?.integrity === integrity, "registry/local SHA512 SRI conflict");
  const url = new URL(metadata.dist.tarball);
  requireThat(url.origin === "https://registry.npmjs.org" && !url.username && !url.password && !url.hash && !url.search,
    "unexpected registry tarball URL");
  const downloaded = join(dir, "registry.tgz");
  requireThat(download(url.href, downloaded) === "200", "registry tarball download failed");
  requireThat(sha512(downloaded).equals(digest), "downloaded/local SHA512 conflict");
  tarIdentity(downloaded, expected);

  // A disposable exact dependency lets the supported npm CLI verify registry
  // signatures and Sigstore attestations. No dependency lifecycle scripts run.
  const auditDir = join(dir, "audit");
  mkdirSync(auditDir);
  writeFileSync(join(auditDir, "package.json"), JSON.stringify({ private: true }));
  try {
    command("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", `--registry=${registry}`, `${expected.name}@${expected.version}`], auditDir);
    const location = `node_modules/${expected.name}`;
    const locked = readJson(join(auditDir, "package-lock.json"))?.packages?.[location];
    requireThat(locked?.integrity === integrity && locked?.resolved === url.href, "audited dependency artifact conflict");
    requireIdentity(readJson(join(auditDir, location, "package.json")), expected, "audited dependency");
    const audit = JSON.parse(command("npm", ["audit", "signatures", "--json", "--include-attestations", "--ignore-scripts", `--registry=${registry}`], auditDir).stdout);
    requireProvenance(audit, expected, digest, ref, sha);
  } finally {
    rmSync(auditDir, { recursive: true, force: true });
  }
}

function release() {
  const expected = readJson("package.json");
  const { GITHUB_REPOSITORY, GITHUB_REF: ref, GITHUB_REF_NAME: tag, GITHUB_SHA: sha, GITHUB_WORKFLOW_REF } = process.env;
  requireThat(GITHUB_REPOSITORY === repository && expected.name === "@comfyorg/comfy-multi-player" &&
    typeof expected.version === "string" && tag === `${tagPrefix}${expected.version}` && ref === `refs/tags/${tag}` &&
    GITHUB_WORKFLOW_REF === `${repository}/${workflowPath}@${ref}` && /^[a-f0-9]{40}$/.test(sha ?? ""),
  "release context does not match package/repository/workflow/tag");
  requireThat(command("npm", ["--version"]).stdout.trim() === "11.19.0", "release requires npm 11.19.0 (verified attestation bundles)");
  requireThat(command("git", ["rev-parse", "HEAD"]).stdout.trim() === sha, "checkout is not GITHUB_SHA");
  requireRemoteTag(ref, sha);

  const dir = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "cmp-release-"));
  console.log(`Release diagnostics retained in ${dir}`);
  // pnpm applies publishConfig and resolves catalog: specifiers; the build
  // already ran under the gates, so prepack must not rebuild it here.
  const pack = JSON.parse(command("pnpm", ["pack", "--config.ignore-scripts=true", "--json", "--pack-destination", dir]).stdout);
  requireThat(pack !== null && typeof pack === "object" && !Array.isArray(pack), "expected one packed artifact");
  requireIdentity(pack, expected, "pack manifest");
  const filename = pack.filename;
  requireThat(isAbsolute(filename), "invalid packed filename");
  requireThat(filename.endsWith(".tgz"), "invalid packed filename");
  const tarball = filename;
  requireThat(realpathSync(dirname(tarball)) === realpathSync(dir), "packed artifact is outside the release directory");
  requirePublishManifest(tarIdentity(tarball, expected), expected);
  const digest = sha512(tarball);
  console.log(`Packed ${expected.name}@${expected.version}: sha512-${digest.toString("base64")}`);

  // Inspect both services before any write. A failed lookup is never absence.
  const hasRelease = releaseExists(tag);
  const metadataPath = join(dir, "registry.json");
  const status = download(`${registry}${encodeURIComponent(expected.name)}/${encodeURIComponent(expected.version)}`, metadataPath);
  const metadata = readJson(metadataPath);
  const absent = status === "404" && metadata === `version not found: ${expected.version}`;
  if (!absent) {
    requireThat(status === "200", "registry version lookup failed (not a definitive version 404)");
    verifyExisting(metadata, expected, digest, dir, ref, sha);
    console.log("Existing npm artifact and verified provenance match; skipping npm publish");
  }

  // Recheck after potentially slow download/verification, before either write.
  // Remote tag protection remains necessary: no client can atomically lock a tag
  // across the independent npm and GitHub services.
  requireRemoteTag(ref, sha);
  if (absent) command("npm", ["publish", tarball, "--provenance", "--access", "public", "--ignore-scripts", `--registry=${registry}`]);
  requireRemoteTag(ref, sha);
  if (!hasRelease) {
    // --latest=false: Latest belongs to the frontend's own v<semver> releases.
    command("gh", ["release", "create", tag, "--repo", repository, "--verify-tag", "--latest=false", "--title", tag,
      "--notes", `Published ${expected.name}@${expected.version} to npm: https://www.npmjs.com/package/${expected.name}/v/${expected.version}`]);
  }
  console.log("Release recovery complete");
}

try {
  release();
} catch (error) {
  console.error(`release recovery failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
