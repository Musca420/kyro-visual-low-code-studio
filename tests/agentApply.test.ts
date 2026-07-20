import { describe, expect, it } from "vitest";
import { parseAgentApply } from "../src/agentApply";

describe("Codex apply result", () => {
  it("requires structured verification evidence", () => {
    expect(parseAgentApply(JSON.stringify({ status: "completed", summary: "Applied", transactionId: "tx-1", validation: [], visualResult: "Preview captured", learningCandidate: null })))
      .toMatchObject({ status: "completed", transactionId: "tx-1" });
    expect(parseAgentApply("{}" )).toBeUndefined();
  });
});
