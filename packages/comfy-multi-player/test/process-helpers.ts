import { accessSync, constants } from "node:fs";
import { join } from "node:path";

/**
 * These integration tests already require POSIX tools (shell scripts, tar).
 * Resolve those tools from system directories, never a fixture-controlled PATH.
 * A child's PATH remains independently configurable to exercise fake tools.
 */
export function systemExecutable(name: "bash" | "git" | "tar"): string {
  for (const directory of ["/usr/bin", "/bin", "/usr/local/bin"]) {
    const executable = join(directory, name);
    try {
      accessSync(executable, constants.X_OK);
      return executable;
    } catch {
      // Try the next system location; absence is an explicit test setup failure.
    }
  }
  throw new Error(`Required POSIX test tool ${name} is not installed in a system directory`);
}
