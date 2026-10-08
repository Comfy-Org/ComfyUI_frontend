import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKAGE_DIR = "packages/comfy-multi-player";
const repoRoot = join(packageRoot, "..", "..");
const CI_WORKFLOW = ".github/workflows/ci-comfy-multi-player.yaml";
const MUTATION_WORKFLOW = ".github/workflows/mutation-comfy-multi-player.yaml";
const PUBLISH_WORKFLOW = ".github/workflows/publish-comfy-multi-player.yaml";
const INSTALL_COMMAND = "pnpm install --frozen-lockfile --ignore-scripts";
const VERIFY_COMMAND = "pnpm run verify:package";
const REQUIRED_STEPS = {
  Install: INSTALL_COMMAND,
  "Verify conformance corpus": "pnpm run verify:corpus",
  Build: "pnpm run build",
  "Type-check gate": "pnpm run typecheck",
  "Purity gate": "pnpm run check:purity",
  "Statelessness gate": "pnpm run check:stateless",
  "Profile-claim staleness gate": "pnpm run check:profile-claims",
  "CodeRabbit config drift gate": "pnpm run check:coderabbit",
  "Import-graph gate": "pnpm run check:imports",
  "Citation-pin gate (FC-10)": "pnpm run check:pins",
  Tests: "pnpm test --exclude test/stateless.test.ts",
  "Clock ordering matrix": "pnpm run test:clock-matrix",
  "Verify package contents": VERIFY_COMMAND,
};
const CI_ONLY_STEPS = { "Lint gate": "pnpm run lint" };

interface RunDefaults {
  run?: { shell?: unknown; "working-directory"?: unknown };
}

interface Step {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  if?: unknown;
  shell?: unknown;
  "working-directory"?: unknown;
  "continue-on-error"?: unknown;
}

interface Job extends Step {
  steps?: Step[];
  needs?: unknown;
  defaults?: RunDefaults;
}

interface Workflow {
  on?: unknown;
  env?: Record<string, unknown>;
  defaults?: RunDefaults;
  jobs: Record<string, Job>;
}

interface CiFixture extends Workflow {
  jobs: { ci: Job & { steps: Step[] }; decoy?: Job } & Record<string, Job>;
}

// These gates are unconditional today. New conditions require a deliberate
// contract update; do not try to evaluate GitHub's expression language here.
// Shell overrides likewise need review because they can skip the run script.
function unconditionalGate(value: Step): boolean {
  return value.if === undefined && value.shell === undefined &&
    (value["continue-on-error"] === undefined || value["continue-on-error"] === false);
}

/** The directory a `run` step executes in, relative to the repository root. */
function workingDirectory(workflow: Workflow, job: Job, step: Step): string {
  const directory = step["working-directory"] ?? job.defaults?.run?.["working-directory"] ??
    workflow.defaults?.run?.["working-directory"] ?? ".";
  return String(directory).replace(/^\.\/(?=.)/, "").replace(/\/$/, "");
}

function requireWorkflow(document: unknown, jobId: string): void {
  const workflow = document as Workflow;
  const job = workflow?.jobs?.[jobId];
  assert(job, `missing required job: ${jobId}`);
  assert(unconditionalGate(job), `missing required job: ${jobId}`);
  assert.equal(workflow.defaults?.run?.shell, undefined, "required gates must use the default runner shell");
  assert.equal(job.defaults?.run?.shell, undefined, "required gates must use the default runner shell");
  const steps = job.steps ?? [];
  const requiredSteps = jobId === "ci" ? { ...REQUIRED_STEPS, ...CI_ONLY_STEPS } : REQUIRED_STEPS;
  for (const [name, command] of Object.entries(requiredSteps)) {
    const matches = steps.filter((step) => step.name === name);
    const message = `missing active, failure-propagating ${name}: ${command}`;
    assert.equal(matches.length, 1, message);
    const [step] = matches;
    assert(step, message);
    assert(unconditionalGate(step), message);
    assert.equal(step.run?.trim(), command, message);
    const expected = name === "Install" ? "." : PACKAGE_DIR;
    assert.equal(workingDirectory(workflow, job, step), expected, `${name} must run in ${expected}`);
  }
  const buildIndex = steps.findIndex((step) => step.name === "Build");
  const packIndex = steps.findIndex((step) => step.name === "Verify package contents");
  if (packIndex <= buildIndex) throw new Error("Verify package contents must run after Build");
  if (jobId === "publish") requireRelease(workflow, job, steps);
}

function requireRelease(workflow: Workflow, job: Job, steps: Step[]): void {
  const recovery = steps.filter((step) => step.name === "Verify identity and recover release");
  assert.equal(recovery.length, 1);
  const [recover] = recovery;
  assert(recover);
  assert(unconditionalGate(recover));
  assert.equal(recover.run, "node scripts/release-retry.mjs");
  assert.equal(recover.env?.GH_TOKEN, "${{ github.token }}");
  assert.equal(workingDirectory(workflow, job, recover), PACKAGE_DIR);
  const recoveryIndex = steps.indexOf(recover);
  for (const name of Object.keys(REQUIRED_STEPS)) {
    if (steps.findIndex((step) => step.name === name) >= recoveryIndex) {
      throw new Error(`release recovery must follow ${name}`);
    }
  }
  const toolchain = steps.filter((step) => step.name === "Pin release npm");
  assert.equal(toolchain.length, 1);
  const [npm] = toolchain;
  assert(npm);
  assert(unconditionalGate(npm));
  assert.equal(npm.run, "npm install --global npm@11.19.0 --ignore-scripts");
  assert(steps.indexOf(npm) < steps.findIndex((step) => step.name === "Install"));
  const node = steps.find((step) => step.uses?.startsWith("actions/setup-node@"));
  assert(node);
  assert(unconditionalGate(node));
  assert.equal(node.with?.["node-version-file"], ".nvmrc");
  assert.equal(node.with?.["node-version"], undefined);
  if (steps.some((step) => /(?:npm|pnpm) publish|gh release create/.test(step.run ?? ""))) {
    throw new Error("release writes must go through identity/recovery gate");
  }
}

const readRepo = (relative: string) => readFileSync(join(repoRoot, relative), "utf8");
const readPackage = (relative: string) => readFileSync(join(packageRoot, relative), "utf8");
const loadYaml = (relative: string) => parse(readRepo(relative)) as unknown;
const section = (markdown: string, heading: string) => markdown.split(`${heading}\n`)[1]?.split("\n## ")[0];

describe("monorepo package ownership", () => {
  it("routes README development to the frontend workspace with pnpm", () => {
    const develop = section(readPackage("README.md"), "## Develop");
    expect(develop).toBeDefined();
    expect(develop).toContain("https://github.com/Comfy-Org/ComfyUI_frontend");
    expect(develop).toContain(PACKAGE_DIR);
    expect(develop).toContain(INSTALL_COMMAND);
    expect(develop).not.toMatch(/\bnpm (?:ci|run)\b/);
  });

  it("installs a specific published version and saves an exact dependency", () => {
    const install = section(readPackage("README.md"), "## Install");
    expect(install).toBeDefined();
    expect(install).toContain("npm install --save-exact @comfyorg/comfy-multi-player@0.3.10");
    expect(install).toContain("comfy-multi-player-v");
  });

  it("records the stacked migration and the cloud rollout blocker", () => {
    const plan = section(readPackage("docs/ROADMAP.md"), "## Repository plan");
    expect(plan).toBeDefined();
    expect(plan).toContain("canonical writable source");
    expect(plan).toContain(PACKAGE_DIR);
    expect(plan).toContain("0.3.6");
    expect(plan).toContain("workspace:*");
    expect(plan).toContain("cloud rollout");
    expect(plan).toContain("comfy-multi-player-v");
    expect(plan).not.toMatch(/migration[^.]*is closed and deferred/);
  });

  it("distinguishes workspace consumption from deployed compatibility", () => {
    const schema = readPackage("docs/multiplayer-schema.md");
    expect(schema).not.toContain("frontend source migration is deferred");
    expect(schema).toContain(`source now lives in \`${PACKAGE_DIR}\``);
    expect(schema).toContain("switch requires cloud rollout alignment");
  });

  it("routes vulnerability reports to the frontend repository's private channel", () => {
    const security = readPackage("SECURITY.md");
    expect(security).toContain("https://github.com/Comfy-Org/ComfyUI_frontend/security/advisories/new");
    expect(security).toContain("support@comfy.org");
    expect(security).not.toContain(".github/dependabot.yml");
  });

  it("owns CI from the repository root rather than an inert nested workflow directory", () => {
    for (const nested of ["ci.yml", "mutation.yml"]) {
      expect(existsSync(join(packageRoot, ".github/workflows", nested)), nested).toBe(false);
    }
    expect(existsSync(join(packageRoot, ".coderabbit.yaml"))).toBe(false);
    for (const workflow of [CI_WORKFLOW, MUTATION_WORKFLOW, PUBLISH_WORKFLOW]) {
      expect(existsSync(join(repoRoot, workflow)), workflow).toBe(true);
    }
  });
});

describe("root workflow triggers and trust", () => {
  it("gates pull requests, the merge queue, and main", () => {
    const { on } = loadYaml(CI_WORKFLOW) as { on: Record<string, { branches?: string[] } | null> };
    expect(Object.keys(on).sort()).toEqual(["merge_group", "pull_request", "push"]);
    expect(on.push?.branches).toEqual(["main"]);
    expect(on.pull_request).toBeNull();
  });

  it.each([CI_WORKFLOW, MUTATION_WORKFLOW])("%s holds no secrets and a read-only token", (file) => {
    const workflow = loadYaml(file) as Workflow & { permissions?: unknown };
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(readRepo(file)).not.toMatch(/secrets\.|pull_request_target|id-token/);
    for (const job of Object.values(workflow.jobs)) {
      expect(job).not.toHaveProperty("permissions");
      const checkout = job.steps?.find((step) => step.uses?.startsWith("actions/checkout@"));
      expect(checkout?.with?.["persist-credentials"]).toBe(false);
    }
  });

  it("keeps nightly mutation testing off the PR path and its report always checked", () => {
    const workflow = loadYaml(MUTATION_WORKFLOW) as Workflow;
    expect(Object.keys(workflow.on as object).sort()).toEqual(["schedule", "workflow_dispatch"]);
    const job = workflow.jobs.mutation!;
    const steps = job.steps ?? [];
    const named = (name: string) => steps.find((step) => step.name === name)!;
    expect(named("Install").run).toBe(INSTALL_COMMAND);
    expect(workingDirectory(workflow, job, named("Install"))).toBe(".");
    expect(named("Mutation tests").run).toBe("pnpm run test:mutation");
    expect(named("Check mutation report")).toMatchObject({ if: "always()", run: "pnpm run check:mutation-report" });
    for (const name of ["Build", "Mutation tests", "Check mutation report"]) {
      expect(workingDirectory(workflow, job, named(name)), name).toBe(PACKAGE_DIR);
    }
    const cache = named("Restore incremental mutation report");
    expect(cache.with?.path).toBe(`${PACKAGE_DIR}/reports/stryker-incremental.json`);
    expect(String(cache.with?.key)).toContain(`hashFiles('pnpm-lock.yaml', '${PACKAGE_DIR}/stryker.config.mjs')`);
    expect(named("Upload mutation report").with?.path).toBe(`${PACKAGE_DIR}/reports/mutation/`);
  });
});

describe("parsed CI and release contracts", () => {
  it.each([
    ["missing", (step: Step) => { step.name = "comment-only lint"; }],
    ["conditional", (step: Step) => { step.if = "${{ false }}"; }],
    ["non-fatal", (step: Step) => { step["continue-on-error"] = true; }],
    ["masked exit", (step: Step) => { step.run = "pnpm run lint || true"; }],
  ] as const)("rejects a %s lint gate", (_name, change) => {
    const document = loadYaml(CI_WORKFLOW) as CiFixture;
    const lint = document.jobs.ci.steps.find((step) => step.name === "Lint gate");
    expect(lint).toBeDefined();
    change(lint!);
    expect(() => requireWorkflow(document, "ci")).toThrow("missing active, failure-propagating Lint gate");
  });

  it.each([[CI_WORKFLOW, "ci"], [PUBLISH_WORKFLOW, "publish"]])(
    "%s runs every required gate and propagates failure",
    (file, job) => requireWorkflow(loadYaml(file), job),
  );

  it.each(Object.keys(REQUIRED_STEPS))("rejects release recovery before %s", (name) => {
    const document = loadYaml(PUBLISH_WORKFLOW) as { jobs: { publish: { steps: Step[] } } };
    const steps = document.jobs.publish.steps;
    const index = steps.findIndex((step) => step.name === "Verify identity and recover release");
    const recovery = steps.splice(index, 1)[0]!;
    steps.splice(steps.findIndex((step) => step.name === name), 0, recovery);
    expect(() => requireWorkflow(document, "publish")).toThrow("release recovery must follow");
  });

  const recoveryStep = (steps: Step[]) => steps.find((step) => step.name === "Verify identity and recover release")!;
  it.each([
    ["conditional recovery", (steps: Step[]) => { recoveryStep(steps).if = "${{ success() }}"; }],
    ["non-fatal recovery", (steps: Step[]) => { recoveryStep(steps)["continue-on-error"] = true; }],
    ["changed helper", (steps: Step[]) => { recoveryStep(steps).run = "echo skipped"; }],
    ["helper outside the package", (steps: Step[]) => { recoveryStep(steps)["working-directory"] = "."; }],
    ["old npm", (steps: Step[]) => { steps.find((step) => step.name === "Pin release npm")!.run = "npm install --global npm@10.9.7"; }],
    ["moving Node", (steps: Step[]) => {
      const node = steps.find((step) => step.uses?.startsWith("actions/setup-node@"))!;
      delete node.with!["node-version-file"];
      node.with!["node-version"] = 24;
    }],
    ["unguarded npm publication", (steps: Step[]) => { steps.push({ run: "npm publish --provenance --access public" }); }],
    ["unguarded pnpm publication", (steps: Step[]) => { steps.push({ run: "pnpm publish --no-git-checks" }); }],
  ] as const)("rejects %s", (_name, change) => {
    const document = loadYaml(PUBLISH_WORKFLOW) as { jobs: { publish: { steps: Step[] } } };
    change(document.jobs.publish.steps);
    expect(() => requireWorkflow(document, "publish")).toThrow();
  });

  it.each(Object.keys(REQUIRED_STEPS))("rejects a missing %s even when named in comments", (name) => {
    const yaml = readRepo(CI_WORKFLOW);
    const document = parse(`${yaml}\n# ${name}: ${REQUIRED_STEPS[name as keyof typeof REQUIRED_STEPS]}\n`) as CiFixture;
    document.jobs.ci.steps = document.jobs.ci.steps.filter((step: Step) => step.name !== name);
    expect(() => requireWorkflow(document, "ci")).toThrow(`missing active, failure-propagating ${name}:`);
  });

  it.each([false, "${{ false }}", "github.ref == 'refs/heads/never'"])("rejects a conditional gate: %s", (condition) => {
    const document = loadYaml(CI_WORKFLOW) as CiFixture;
    document.jobs.ci.steps.find((step) => step.name === "Verify package contents")!.if = condition;
    expect(() => requireWorkflow(document, "ci")).toThrow("missing active, failure-propagating Verify package contents");
  });

  it.each(["step", "job", "workflow"])("rejects a %s shell that skips gate execution", (scope) => {
    const document = loadYaml(CI_WORKFLOW) as CiFixture;
    if (scope === "step") {
      document.jobs.ci.steps.find((step) => step.name === "Verify package contents")!.shell = "echo {0}";
    } else if (scope === "job") {
      document.jobs.ci.defaults = { run: { ...document.jobs.ci.defaults?.run, shell: "echo {0}" } };
    } else {
      document.defaults = { run: { shell: "echo {0}" } };
    }
    expect(() => requireWorkflow(document, "ci")).toThrow();
  });

  it.each([
    ["a gate run at the repository root", (document: CiFixture) => {
      document.jobs.ci.steps.find((step) => step.name === "Tests")!["working-directory"] = ".";
    }, "Tests must run in packages/comfy-multi-player"],
    ["gates left at the root by a dropped job default", (document: CiFixture) => {
      delete document.jobs.ci.defaults;
    }, "must run in packages/comfy-multi-player"],
    ["an install moved into the package", (document: CiFixture) => {
      delete document.jobs.ci.steps.find((step) => step.name === "Install")!["working-directory"];
    }, "Install must run in ."],
    ["an install that runs lifecycle scripts", (document: CiFixture) => {
      document.jobs.ci.steps.find((step) => step.name === "Install")!.run = "pnpm install --frozen-lockfile";
    }, "missing active, failure-propagating Install"],
  ] as const)("rejects %s", (_name, change, message) => {
    const document = loadYaml(CI_WORKFLOW) as CiFixture;
    change(document);
    expect(() => requireWorkflow(document, "ci")).toThrow(message);
  });

  it.each([true, "${{ true }}"])("rejects non-fatal steps and jobs: %s", (value) => {
    const document = loadYaml(CI_WORKFLOW) as CiFixture;
    document.jobs.ci.steps.find((step) => step.name === "Verify package contents")!["continue-on-error"] = value;
    expect(() => requireWorkflow(document, "ci")).toThrow("missing active, failure-propagating Verify package contents");
    document.jobs.ci["continue-on-error"] = value;
    expect(() => requireWorkflow(document, "ci")).toThrow("missing required job");
  });

  it("rejects a disabled job and a command copied to an unrelated value or job", () => {
    const document = loadYaml(CI_WORKFLOW) as CiFixture;
    document.jobs.ci.if = "${{ false }}";
    expect(() => requireWorkflow(document, "ci")).toThrow("missing required job");
    delete document.jobs.ci.if;
    const step = document.jobs.ci.steps.find((candidate) => candidate.name === "Verify package contents")!;
    document.env = { NOTE: step.run };
    document.jobs.decoy = { steps: [structuredClone(step)] };
    step.run = "echo skipped";
    expect(() => requireWorkflow(document, "ci")).toThrow("missing active, failure-propagating Verify package contents");
  });

  it("rejects verification before the build", () => {
    const document = loadYaml(CI_WORKFLOW) as CiFixture;
    const steps = document.jobs.ci.steps;
    const index = steps.findIndex((step) => step.name === "Verify package contents");
    steps.unshift(...steps.splice(index, 1));
    expect(() => requireWorkflow(document, "ci")).toThrow("Verify package contents must run after Build");
  });
});

describe("root CodeRabbit delivery", () => {
  interface PathInstruction { path: string; instructions: string }
  const rules = () =>
    (loadYaml(".coderabbit.yaml") as { reviews: { path_instructions: PathInstruction[] } }).reviews.path_instructions;

  it("delivers the CI contract rule for the root workflows by structured fields", () => {
    const rule = rules().find(({ path }) => path.includes(".github/workflows/"));
    expect(rule?.path).toBe(
      `{${PACKAGE_DIR}/package.json,${PACKAGE_DIR}/tsconfig.json,${PACKAGE_DIR}/stryker.config.mjs,` +
        ".github/workflows/*-comfy-multi-player.yaml}",
    );
    for (const name of Object.keys({ ...REQUIRED_STEPS, ...CI_ONLY_STEPS })) {
      expect(rule?.instructions).toContain(`\`${name}\``);
    }
    expect(rule?.instructions).toContain("Do not remove or make non-fatal");
    expect(rule?.instructions).toContain(INSTALL_COMMAND);
  });

  it("scopes every package rule to the package or its named root workflows, after the frontend's rules", () => {
    const all = rules();
    const firstPackageRule = all.findIndex(({ path }) => path.includes("comfy-multi-player"));
    expect(all.slice(0, firstPackageRule).map(({ path }) => path)).toEqual(
      expect.arrayContaining(["**/*.ts", "**/*.test.ts"]),
    );
    const packageRules = all.slice(firstPackageRule);
    expect(packageRules.map(({ path }) => path)).toEqual(expect.arrayContaining([
      `${PACKAGE_DIR}/src/**`, `${PACKAGE_DIR}/scripts/**`, `${PACKAGE_DIR}/test/**`,
    ]));
    for (const { path } of packageRules) {
      const alternatives = /^\{([^{}]*)\}$/.exec(path)?.[1]?.split(",") ?? [path];
      for (const alternative of alternatives) {
        expect(alternative.startsWith(`${PACKAGE_DIR}/`) || /^\.github\/workflows\/[^/]*comfy-multi-player/.test(alternative),
          alternative).toBe(true);
      }
    }
  });
});
