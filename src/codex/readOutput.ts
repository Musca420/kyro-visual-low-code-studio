export type Trace = {
  commands: { command: string; output: string; exitCode: number | null }[];
  files: string[];
  diff: string;
  tests: { command: string; passed: boolean; output: string }[];
};

export function readOutput(raw: string, git?: { status?: string; diff?: string }) {
  const events = raw.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const messages = events
    .filter((event) => event.item?.type === "agent_message" && event.item.text)
    .map((event) => event.item.text as string);
  const commands = events
    .filter(
      (event) =>
        event.item?.type === "command_execution" &&
        event.item.status === "completed",
    )
    .map((event) => ({
      command: String(event.item.command ?? ""),
      output: String(event.item.aggregated_output ?? ""),
      exitCode:
        typeof event.item.exit_code === "number" ? event.item.exit_code : null,
    }));
  const tests = commands
    .filter((item) =>
      /(?:npm|pnpm|yarn|npx)\s+(?:run\s+)?(?:test|check|lint|typecheck|build)|pytest|vitest|playwright/i.test(
        item.command,
      ),
    )
    .map((item) => ({
      command: item.command,
      passed: item.exitCode === 0,
      output: item.output,
    }));
  return {
    text: messages.at(-1) || raw,
    trace: {
      commands,
      tests,
      files: String(git?.status ?? "")
        .split("\n")
        .filter(Boolean),
      diff: String(git?.diff ?? ""),
    } as Trace,
  };
}
