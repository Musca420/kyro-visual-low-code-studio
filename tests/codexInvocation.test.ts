import { describe, expect, it } from "vitest";
import { codexExecArguments, codexFailure, codexFinalMessage, codexThreadId, codexUsage, codexUsedDisallowedShell, codexUsedShell } from "../server/codexInvocation";

describe("Codex-first invocation", () => {
  it("starts planning and always resumes that thread for apply", () => {
    expect(codexExecArguments("plan", "", "plan.json")).toEqual(["exec", "--ignore-user-config", "--json", "--skip-git-repo-check", "--output-schema", "plan.json", "-"]);
    expect(codexExecArguments("apply", "thread-1", "apply.json")).toEqual(["exec", "resume", "--ignore-user-config", "--json", "--skip-git-repo-check", "--output-schema", "apply.json", "thread-1", "-"]);
    expect(() => codexExecArguments("apply")).toThrow(/thread to resume/i);
  });

  it("reads the persistent thread from Codex JSONL", () => {
    const output = '{"type":"thread.started","thread_id":"abc"}\n' +
      '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"summary\\":\\"done\\"}"}}\n';
    expect(codexThreadId(output)).toBe("abc");
    expect(codexFinalMessage(output)).toBe('{"summary":"done"}');
    expect(codexUsedShell(output)).toBe(false);
    expect(codexUsedShell('{"item":{"type":"command_execution"}}')).toBe(true);
    expect(codexUsedDisallowedShell('{"item":{"type":"command_execution","command":"powershell -Command \\"Get-Content -Raw \'C:\\\\repo\\\\.agents\\\\skills\\\\kyro-live\\\\SKILL.md\'\\""}}')).toBe(false);
    expect(codexUsedDisallowedShell('{"item":{"type":"command_execution","command":"powershell -Command \\"Get-Content -Raw \'C:\\\\repo\\\\.agents\\\\skills\\\\kyro-live\\\\SKILL.md\'; Get-Content -Raw \'C:\\\\repo\\\\.agents\\\\skills\\\\kyro-design\\\\SKILL.md\'\\""}}')).toBe(false);
    expect(codexUsedDisallowedShell('{"item":{"type":"command_execution","command":"powershell -Command \\"Get-Content -Raw -LiteralPath \'C:\\\\repo\\\\.agents\\\\skills\\\\kyro-live\\\\SKILL.md\'; Get-Content -Raw -LiteralPath \'C:\\\\repo\\\\.agents\\\\skills\\\\kyro-actions\\\\SKILL.md\'\\""}}')).toBe(false);
    expect(codexUsedDisallowedShell(JSON.stringify({ item: { type: "command_execution", command: String.raw`powershell -Command "Get-Content -Raw 'C:\\repo\\.agents\\skills\\kyro-live\\SKILL.md'; Get-Content -Raw 'C:\\repo\\.agents\\skills\\kyro-data\\SKILL.md'"` } }))).toBe(false);
    expect(codexUsedDisallowedShell('{"item":{"type":"command_execution","command":"powershell -Command \\"Get-Content -Raw \'C:\\\\repo\\\\src\\\\App.tsx\'\\""}}')).toBe(true);
    expect(codexUsedDisallowedShell('{"item":{"type":"command_execution","command":"powershell -Command \\"Get-Content -Raw \'C:\\\\repo\\\\.agents\\\\skills\\\\x\\\\SKILL.md\'; rg secret\\""}}')).toBe(true);
    expect(codexFailure('{"type":"turn.failed","error":{"message":"Bad schema"}}')).toBe("Bad schema");
    expect(codexUsage('{"type":"turn.completed","usage":{"input_tokens":12,"cached_input_tokens":8,"output_tokens":3,"reasoning_output_tokens":1}}')).toEqual({ inputTokens: 12, cachedInputTokens: 8, outputTokens: 3, reasoningOutputTokens: 1, totalTokens: 15 });
  });
});
