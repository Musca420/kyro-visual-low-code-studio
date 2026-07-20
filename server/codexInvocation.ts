export function codexExecArguments(mode: "plan" | "apply", threadId = "", outputSchema = "") {
  if (mode === "apply" && !threadId.trim()) throw new Error("The approved plan has no Codex thread to resume.");
  return mode === "plan"
    ? ["exec", "--ignore-user-config", "--json", "--skip-git-repo-check", ...(outputSchema ? ["--output-schema", outputSchema] : []), "-"]
    : ["exec", "resume", "--ignore-user-config", "--json", "--skip-git-repo-check", ...(outputSchema ? ["--output-schema", outputSchema] : []), threadId.trim(), "-"];
}

export function codexThreadId(output: string, fallback = "") {
  return (output.match(/"type"\s*:\s*"thread\.started"[^\r\n]*"thread_id"\s*:\s*"([^"]+)"/)?.[1]
    ?? fallback.trim()) || undefined;
}

export function codexEvents(output: string): Record<string, unknown>[] {
  return output.split(/\r?\n/).flatMap((line) => {
    try { return [JSON.parse(line) as Record<string, unknown>]; }
    catch { return []; }
  });
}

export function codexFinalMessage(output: string) {
  return codexEvents(output).flatMap((event) => {
    const item = event.item as Record<string, unknown> | undefined;
    return item?.type === "agent_message" && typeof item.text === "string" ? [item.text] : [];
  }).at(-1) ?? "";
}

export function codexUsedShell(output: string) {
  return codexEvents(output).some((event) => {
    const item = event.item as Record<string, unknown> | undefined;
    return item?.type === "command_execution";
  });
}

export function codexUsedDisallowedShell(output: string) {
  return codexEvents(output).some((event) => {
    const item = event.item as Record<string, unknown> | undefined;
    if (item?.type !== "command_execution") return false;
    const command = typeof item.command === "string" ? item.command : "";
    if (/[|\r\n]|&&/.test(command)) return true;
    const body = command.slice(command.indexOf("Get-Content"));
    const skillRead = /Get-Content\s+-Raw\s+(?:-LiteralPath\s+)?'([^']+)'/gi;
    const reads = [...body.matchAll(skillRead)];
    if (!reads.length || reads.some((match) => {
      const path = match[1].replaceAll("/", "\\").replace(/\\+/g, "\\").toLocaleLowerCase();
      return !path.includes("\\.agents\\skills\\") || !/\.(?:md|ya?ml)$/.test(path);
    })) return true;
    return body.replace(skillRead, "").replace(/[;"\s]/g, "").length > 0;
  });
}

export function codexFailure(output: string) {
  return codexEvents(output).flatMap((event) => {
    if (event.type === "error" && typeof event.message === "string") return [event.message];
    const error = event.error as Record<string, unknown> | undefined;
    return event.type === "turn.failed" && typeof error?.message === "string" ? [error.message] : [];
  }).at(-1) ?? "";
}

export function codexUsage(output: string) {
  const usage = codexEvents(output).flatMap((event) => event.type === "turn.completed" && event.usage && typeof event.usage === "object" ? [event.usage as Record<string, unknown>] : []).at(-1);
  if (!usage) return undefined;
  const number = (key: string) => Number(usage[key] ?? 0);
  const inputTokens = number("input_tokens"), cachedInputTokens = number("cached_input_tokens"), outputTokens = number("output_tokens"), reasoningOutputTokens = number("reasoning_output_tokens");
  return { inputTokens, cachedInputTokens, outputTokens, reasoningOutputTokens, totalTokens: inputTokens + outputTokens };
}
