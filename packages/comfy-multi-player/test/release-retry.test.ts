import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { systemExecutable } from "./process-helpers.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, "scripts/release-retry.mjs");
const name = "@comfyorg/comfy-multi-player";
const version = "1.2.3";
const repo = "Comfy-Org/ComfyUI_frontend";
const workflow = ".github/workflows/publish-comfy-multi-player.yaml";
const tag = `comfy-multi-player-v${version}`;
const sha = "1234567890abcdef1234567890abcdef12345678";
const otherSha = "abcdef1234567890abcdef1234567890abcdef12";
const ref = `refs/tags/${tag}`;
const publishExports = { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } };
const registry = "https://registry.npmjs.org/";
const predicateType = "https://slsa.dev/provenance/v1";

// Only external processes are doubled. The release helper runs unchanged in a
// fresh process; real tar/gzip bytes, hashing, parsing and decisions run locally.
// These fixtures do NOT test Sigstore cryptography: npm owns that verification.
const commandFixture = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const f = JSON.parse(fs.readFileSync(process.env.RELEASE_FIXTURE));
const cmd = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(f.log, JSON.stringify({cmd,args,cwd:process.cwd()})+'\n');
const out = value => process.stdout.write(typeof value === 'string' ? value : JSON.stringify(value));
if (cmd === 'git') {
  if (args[0] === 'rev-parse') out(f.head);
  else {
    const probes = fs.readFileSync(f.log,'utf8').trim().split('\n').map(JSON.parse).filter(c => c.args[0] === 'ls-remote').length;
    out(probes >= f.tagChangesAt ? f.changedTag : f.tag);
    process.exitCode = f.tagStatus;
  }
} else if (cmd === 'curl') {
  const target = args[args.indexOf('--output')+1];
  const url = args.at(-1);
  if (url.endsWith('.tgz')) {
    fs.copyFileSync(f.download, target); out(f.downloadStatus);
  } else {
    fs.writeFileSync(target, typeof f.metadata === 'string' ? f.metadata : JSON.stringify(f.metadata));
    out(f.registryStatus);
  }
  process.exitCode = f.curlStatus;
} else if (cmd === 'gh') {
  if (args[0] === 'api') { out(f.release); process.exitCode = f.releaseStatus; }
  else { out('created'); process.exitCode = f.createStatus; }
} else if (cmd === 'pnpm') {
  if (args[0] !== 'pack') throw Error('unexpected pnpm command '+args);
  const dir = args[args.indexOf('--pack-destination')+1];
  fs.copyFileSync(f.local, f.packFilename ?? path.join(dir,'release.tgz'));
  out(f.packOutput ?? {name:f.packName,version:f.packVersion,filename:f.packFilename ?? path.join(dir,'release.tgz'),files:[]});
  process.exitCode = f.packStatus;
} else if (cmd === 'npm') {
  if (args[0] === '--version') out(f.npmVersion);
  else if (args[0] === 'install') {
    const location = 'node_modules/'+f.name;
    fs.mkdirSync(location,{recursive:true});
    fs.writeFileSync(location+'/package.json',JSON.stringify({name:f.name,version:f.version}));
    fs.writeFileSync('package-lock.json',JSON.stringify({packages:{[location]:{integrity:f.lockIntegrity,resolved:f.metadata.dist?.tarball}}}));
    process.exitCode = f.installStatus;
  } else if (args[0] === 'audit') { out(f.audit); process.exitCode = f.auditStatus; }
  else if (args[0] === 'publish') { out('published'); process.exitCode = f.publishStatus; }
  else throw Error('unexpected npm command '+args);
} else throw Error('unexpected command '+cmd);
`;

const packedManifest = { name, version, exports: publishExports, dependencies: { yjs: "^13.6.32" } };

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "release-retry-test-"));
  mkdirSync(join(dir, "bin"));
  mkdirSync(join(dir, "package"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({
    name, version, exports: { ".": "./src/index.ts" }, dependencies: { yjs: "catalog:" }, publishConfig: { exports: publishExports },
  }));
  writeFileSync(join(dir, "package/package.json"), JSON.stringify(packedManifest));
  const local = join(dir, "local.tgz");
  const tar = spawnSync(systemExecutable("tar"), ["-czf", local, "package/package.json"], { cwd: dir });
  if (tar.status !== 0) throw new Error("could not create real tar fixture");
  const digest = createHash("sha512").update(readFileSync(local)).digest();
  const integrity = `sha512-${digest.toString("base64")}`;
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    predicateType,
    subject: [{ name: `pkg:npm/%40comfyorg/comfy-multi-player@${version}`, digest: { sha512: digest.toString("hex") } }],
    predicate: { buildDefinition: {
      buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
      externalParameters: { workflow: { repository: `https://github.com/${repo}`, path: workflow, ref } },
      resolvedDependencies: [{ uri: `git+https://github.com/${repo}@${ref}`, digest: { gitCommit: sha } }],
    } },
  };
  const record = {
    name, version, location: `node_modules/${name}`, registry,
    attestations: { provenance: { predicateType } },
    attestationBundles: [{ predicateType, bundle: { dsseEnvelope: { payloadType: "application/vnd.in-toto+json", payload: "" } } }],
  };
  const data = {
    name, version, log: join(dir, "commands.jsonl"), local, download: local,
    head: sha, tag: `${sha}\t${ref}\n`, tagStatus: 0,
    tagChangesAt: 99, changedTag: `${otherSha}\t${ref}\n`, env: {} as Record<string, string>,
    npmVersion: "11.19.0", packName: name, packVersion: version, packStatus: 0,
    packFilename: undefined as string | undefined, packOutput: undefined as unknown,
    metadata: { name, version, dist: { integrity, tarball: `${registry}@comfyorg/comfy-multi-player/-/comfy-multi-player-${version}.tgz` } } as unknown,
    registryStatus: "200", curlStatus: 0, downloadStatus: "200", lockIntegrity: integrity,
    release: `HTTP/2.0 404 Not Found\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ message: "Not Found" })}`,
    releaseStatus: 1, createStatus: 0, publishStatus: 0, installStatus: 0, auditStatus: 0,
    audit: { invalid: [], missing: [], verified: [record] } as unknown,
  };
  const executable = join(dir, "bin/command.cjs");
  writeFileSync(executable, commandFixture);
  chmodSync(executable, 0o755);
  for (const cmd of ["npm", "pnpm", "git", "curl", "gh"]) symlinkSync(executable, join(dir, "bin", cmd));
  return { dir, data, record, statement };
}

type Fixture = ReturnType<typeof fixture>;
type Command = { cmd: string; args: string[]; cwd: string };
function run(change: (f: Fixture) => void = () => {}) {
  const f = fixture();
  try {
    change(f);
    const envelope = f.record.attestationBundles[0]?.bundle.dsseEnvelope;
    if (envelope && !envelope.payload) envelope.payload = Buffer.from(JSON.stringify(f.statement)).toString("base64");
    writeFileSync(join(f.dir, "fixture.json"), JSON.stringify(f.data));
    const result = spawnSync(process.execPath, [script], {
      cwd: f.dir, encoding: "utf8",
      env: { ...process.env, PATH: `${join(f.dir, "bin")}:${process.env.PATH}`, RELEASE_FIXTURE: join(f.dir, "fixture.json"),
        RUNNER_TEMP: f.dir, GITHUB_REPOSITORY: repo, GITHUB_SHA: sha, GITHUB_REF: ref,
        GITHUB_REF_NAME: tag, GITHUB_WORKFLOW_REF: `${repo}/${workflow}@${ref}`, ...f.data.env },
    });
    const commands: Command[] = existsSync(f.data.log) ? readFileSync(f.data.log, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Command) : [];
    return { ...result, commands, writes: commands.filter(({ cmd, args }) =>
      (cmd === "npm" && args[0] === "publish") || (cmd === "gh" && args[0] === "release")) };
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
}

function repack(f: Fixture, manifest: Record<string, unknown>) {
  writeFileSync(join(f.dir, "package/package.json"), JSON.stringify(manifest));
  expect(spawnSync(systemExecutable("tar"), ["-czf", f.data.local, "package/package.json"], { cwd: f.dir }).status).toBe(0);
  const digest = createHash("sha512").update(readFileSync(f.data.local)).digest();
  f.data.lockIntegrity = `sha512-${digest.toString("base64")}`;
  (f.data.metadata as { dist: { integrity: string } }).dist.integrity = f.data.lockIntegrity;
  f.statement.subject[0]!.digest.sha512 = digest.toString("hex");
}

function absent(f: Fixture) {
  f.data.registryStatus = "404";
  f.data.metadata = JSON.stringify(`version not found: ${version}`);
}

function existingRelease(f: Fixture) {
  f.data.releaseStatus = 0;
  const body = JSON.stringify({ tag_name: tag, draft: false });
  f.data.release = `HTTP/2.0 200 OK\r\nContent-Type: application/json\r\n\r\n${body}`;
}

describe("release retry subprocess orchestration (offline)", () => {
  it.each([false, true])("publishes the one packed tarball after definitive version 404 (existing release: %s)", (hasRelease) => {
    const result = run((f) => {
      absent(f);
      if (hasRelease) existingRelease(f);
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.writes.map(({ cmd, args }) => [cmd, ...args.slice(0, 2)])).toEqual([
      ["npm", "publish", expect.stringMatching(/release\.tgz$/)],
      ...(hasRelease ? [] : [["gh", "release", "create"]]),
    ]);
    expect(result.writes[0]!.args).toEqual(["publish", expect.stringMatching(/release\.tgz$/), "--provenance", "--access", "public", "--ignore-scripts", `--registry=${registry}`]);
    expect(result.commands.filter(({ args }) => args[0] === "pack")).toEqual([
      expect.objectContaining({ cmd: "pnpm", args: ["pack", "--config.ignore-scripts=true", "--json", "--pack-destination", expect.any(String)] }),
    ]);
    expect(result.commands.findIndex(({ args }) => args[0] === "ls-remote")).toBeLessThan(result.commands.indexOf(result.writes[0]!));
    expect(result.commands.findIndex(({ args }) => args[0] === "api")).toBeLessThan(result.commands.indexOf(result.writes[0]!));
    expect(result.commands.some(({ args }) => args[0] === "audit")).toBe(false);
  });

  it("skips only npm publish for exact bytes with verified provenance and creates the missing release", () => {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(result.writes.map(({ cmd, args }) => [cmd, ...args])).toEqual([
      ["gh", "release", "create", tag, "--repo", repo, "--verify-tag", "--latest=false", "--title", tag,
        "--notes", `Published ${name}@${version} to npm: https://www.npmjs.com/package/${name}/v/${version}`],
    ]);
    expect(result.commands.find(({ args }) => args[0] === "install")?.args).toEqual([
      "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", `--registry=${registry}`, `${name}@${version}`,
    ]);
    expect(result.commands.find(({ args }) => args[0] === "audit")?.args).toEqual([
      "audit", "signatures", "--json", "--include-attestations", "--ignore-scripts", `--registry=${registry}`,
    ]);
  });

  it("does no writes when both artifacts already match, including an annotated remote tag", () => {
    const result = run((f) => { existingRelease(f); f.data.tag = `${otherSha}\t${ref}\n${sha}\t${ref}^{}\n`; });
    expect(result.status, result.stderr).toBe(0);
    expect(result.writes).toEqual([]);
  });

  const conflicts: Array<[string, (f: Fixture) => void]> = [
    ["tag changes during verification", (f) => { f.data.tagChangesAt = 2; }],
    ["wrong event tag", (f) => { f.data.env.GITHUB_REF_NAME = "comfy-multi-player-v9.9.9"; }],
    ["standalone-era bare tag", (f) => { f.data.env.GITHUB_REF_NAME = `v${version}`; f.data.env.GITHUB_REF = `refs/tags/v${version}`;
      f.data.env.GITHUB_WORKFLOW_REF = `${repo}/${workflow}@refs/tags/v${version}`; }],
    ["standalone repository", (f) => { f.data.env.GITHUB_REPOSITORY = "Comfy-Org/comfy-multi-player"; }],
    ["wrong workflow context", (f) => { f.data.env.GITHUB_WORKFLOW_REF = `${repo}/.github/workflows/other.yml@${ref}`; }],
    ["standalone workflow context", (f) => { f.data.env.GITHUB_WORKFLOW_REF = `${repo}/.github/workflows/release.yml@${ref}`; }],
    ["wrong remote commit", (f) => { f.data.tag = `${otherSha}\t${ref}\n`; }],
    ["wrong annotated peeled commit", (f) => { f.data.tag = `${sha}\t${ref}\n${otherSha}\t${ref}^{}\n`; }],
    ["missing remote tag", (f) => { f.data.tag = ""; }],
    ["tag transport failure", (f) => { f.data.tagStatus = 128; }],
    ["malformed remote tag", (f) => { f.data.tag = "not a ref"; }],
    ["wrong checkout", (f) => { f.data.head = otherSha; }],
    ["npm10 silently ignores include-attestations", (f) => { f.data.npmVersion = "10.9.7"; }],
    ["pack failure", (f) => { f.data.packStatus = 1; }],
    ["pack manifest name", (f) => { f.data.packName = "other"; }],
    ["pack manifest version", (f) => { f.data.packVersion = "9.9.9"; }],
    ["npm-shaped pack array", (f) => { f.data.packOutput = [{ name, version, filename: "release.tgz" }]; }],
    ["packed artifact outside release directory", (f) => { f.data.packFilename = join(f.dir, "release.tgz"); }],
    ["unresolved catalog dependency in archive", (f) => { repack(f, { ...packedManifest, dependencies: { yjs: "catalog:" } }); }],
    ["unresolved workspace dependency in archive", (f) => { repack(f, { ...packedManifest, peerDependencies: { yjs: "workspace:*" } }); }],
    ["source exports in archive", (f) => { repack(f, { ...packedManifest, exports: { ".": "./src/index.ts" } }); }],
    ["registry auth", (f) => { f.data.registryStatus = "401"; }],
    ["registry rate limit", (f) => { f.data.registryStatus = "429"; }],
    ["registry outage", (f) => { f.data.registryStatus = "503"; }],
    ["registry network", (f) => { f.data.curlStatus = 7; }],
    ["registry malformed JSON", (f) => { f.data.metadata = "not-json"; }],
    ["ambiguous registry 404", (f) => { f.data.registryStatus = "404"; f.data.metadata = "<html>Not Found</html>"; }],
    ["registry name", (f) => { (f.data.metadata as { name: string }).name = "other"; }],
    ["registry version", (f) => { (f.data.metadata as { version: string }).version = "9.9.9"; }],
    ["registry digest", (f) => { (f.data.metadata as { dist: { integrity: string } }).dist.integrity = "sha512-wrong"; }],
    ["registry tarball from another host", (f) => { (f.data.metadata as { dist: { tarball: string } }).dist.tarball = "https://example.com/package.tgz"; }],
    ["download bytes", (f) => {
      // Still a valid package with the expected name/version: tar parsing or
      // identity checks must not accidentally stand in for byte comparison.
      writeFileSync(join(f.dir, "package/extra.txt"), "different artifact");
      f.data.download = join(f.dir, "different.tgz");
      expect(spawnSync(systemExecutable("tar"), ["-czf", f.data.download, "package"], { cwd: f.dir }).status).toBe(0);
    }],
    ["download unavailable", (f) => { f.data.downloadStatus = "503"; }],
    ["different install integrity", (f) => { f.data.lockIntegrity = "sha512-wrong"; }],
    ["install failure", (f) => { f.data.installStatus = 1; }],
    ["cryptographic audit failure despite matching decoded claims", (f) => { f.data.auditStatus = 1; }],
    ["npm10-shaped output from successful audit", (f) => { f.data.audit = { invalid: [], missing: [] }; }],
    ["invalid audit entry", (f) => { f.data.audit = { invalid: [{}], missing: [], verified: [f.record] }; }],
    ["missing audit entry", (f) => { f.data.audit = { invalid: [], missing: [{}], verified: [f.record] }; }],
    ["malformed audit output", (f) => { f.data.audit = "not-json"; }],
    ["duplicate verified records", (f) => { f.data.audit = { invalid: [], missing: [], verified: [f.record, f.record] }; }],
    ["unverified attestation marker", (f) => { f.record.attestationBundles = []; }],
    ["malformed verified payload", (f) => { f.record.attestationBundles[0]!.bundle.dsseEnvelope.payload = Buffer.from("not-json").toString("base64"); }],
    ["wrong verified payload type", (f) => { f.record.attestationBundles[0]!.bundle.dsseEnvelope.payloadType = "text/plain"; }],
    ["wrong verified package", (f) => { f.record.name = "other"; }],
    ["wrong verified version", (f) => { f.record.version = "9.9.9"; }],
    ["wrong verified registry", (f) => { f.record.registry = "https://example.com/"; }],
    ["wrong verified location", (f) => { f.record.location = "node_modules/other"; }],
    ["wrong bundle predicate", (f) => { f.record.attestationBundles[0]!.predicateType = "other"; }],
    ["wrong statement predicate", (f) => { f.statement.predicateType = "other"; }],
    ["wrong subject name", (f) => { f.statement.subject[0]!.name = "pkg:npm/other@1.2.3"; }],
    ["wrong subject digest", (f) => { f.statement.subject[0]!.digest.sha512 = "0".repeat(128); }],
    ["wrong repository", (f) => { f.statement.predicate.buildDefinition.externalParameters.workflow.repository += "-other"; }],
    ["wrong workflow", (f) => { f.statement.predicate.buildDefinition.externalParameters.workflow.path = ".github/workflows/other.yml"; }],
    ["wrong ref", (f) => { f.statement.predicate.buildDefinition.externalParameters.workflow.ref = "refs/heads/main"; }],
    ["wrong source commit", (f) => { f.statement.predicate.buildDefinition.resolvedDependencies[0]!.digest.gitCommit = otherSha; }],
    ["matching commit on unrelated source URI", (f) => { f.statement.predicate.buildDefinition.resolvedDependencies[0]!.uri = "git+https://github.com/other/repo@" + ref; }],
    ["unrelated matching dependency beside wrong source", (f) => {
      f.statement.predicate.buildDefinition.resolvedDependencies[0]!.digest.gitCommit = otherSha;
      f.statement.predicate.buildDefinition.resolvedDependencies.push({ uri: `git+https://github.com/other/repo@${ref}`, digest: { gitCommit: sha } });
    }],
    ["release draft", (f) => { existingRelease(f); f.data.release = f.data.release.replace('"draft":false', '"draft":true'); }],
    ["release wrong tag", (f) => { existingRelease(f); f.data.release = f.data.release.replace(tag, "comfy-multi-player-v9.9.9"); }],
    ["release auth", (f) => { f.data.release = f.data.release.replace("404", "401"); }],
    ["release rate limit", (f) => { f.data.release = f.data.release.replace("404", "429"); }],
    ["release outage", (f) => { f.data.release = f.data.release.replace("404", "503"); }],
    ["release network", (f) => { f.data.release = ""; }],
    ["release malformed JSON", (f) => { f.data.release = "HTTP/2.0 200 OK\r\n\r\nno-json"; f.data.releaseStatus = 0; }],
    ["release ambiguous 404", (f) => { f.data.release = "HTTP/2.0 404 Not Found\r\n\r\n{}"; }],
  ];

  it.each(conflicts)("fails closed with no publish/create: %s", (_label, change) => {
    const result = run(change);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("release recovery failed:");
    expect(result.writes).toEqual([]);
  });

  it("does not publish even an absent version if release inspection is uncertain", () => {
    const result = run((f) => { absent(f); f.data.release = "network failure"; });
    expect(result.status).toBe(1);
    expect(result.writes).toEqual([]);
  });

  it.each(["name", "version"])("rejects conflicting %s inside the actual local archive", (field) => {
    const result = run((f) => repack(f, { ...packedManifest, [field]: "other" }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("tarball: package name/version conflict");
    expect(result.writes).toEqual([]);
  });

  it.each([false, true])("refuses success if the tag moves during npm publication (existing release: %s)", (hasRelease) => {
    const result = run((f) => {
      absent(f);
      if (hasRelease) existingRelease(f);
      f.data.tagChangesAt = 3;
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("remote tag does not resolve to GITHUB_SHA");
    expect(result.writes.map(({ cmd }) => cmd)).toEqual(["npm"]);
  });

  it("propagates a publish failure without creating a release", () => {
    const result = run((f) => { absent(f); f.data.publishStatus = 1; });
    expect(result.status).toBe(1);
    expect(result.writes.map(({ cmd }) => cmd)).toEqual(["npm"]);
  });

  it("propagates a release creation failure; the exact-existing path recovers on retry", () => {
    const first = run((f) => { absent(f); f.data.createStatus = 1; });
    expect(first.status).toBe(1);
    expect(first.writes.map(({ cmd }) => cmd)).toEqual(["npm", "gh"]);
    const retry = run();
    expect(retry.status, retry.stderr).toBe(0);
    expect(retry.writes.map(({ cmd }) => cmd)).toEqual(["gh"]);
  });
});
