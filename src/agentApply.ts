import { z } from "zod";

const applySchema = z.object({
  status: z.enum(["completed", "needs_revision", "failed"]),
  summary: z.string().min(1),
  transactionId: z.string(),
  validation: z.array(z.string()),
  visualResult: z.string().min(1),
  learningCandidate: z.object({
    kind: z.enum(["reusable_flow", "typed_module", "plugin"]),
    name: z.string().min(1),
    generalizedIntent: z.string().min(1),
    inputs: z.array(z.string()),
    outputs: z.array(z.string()),
    activation: z.enum(["passing_tests", "explicit_review"]),
  }).nullable(),
});

export type AgentApplyResult = z.infer<typeof applySchema>;

export function parseAgentApply(value: string): AgentApplyResult | undefined {
  try { return applySchema.parse(JSON.parse(value)); }
  catch { return undefined; }
}
