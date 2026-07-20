import { z } from "zod";

export const capabilityProposalSchema = z.object({
  scope: z.literal("global"),
  kind: z.enum(["reusable_flow", "typed_module", "plugin"]),
  name: z.string().trim().min(3).max(80),
  generalizedIntent: z.string().trim().min(8).max(1_000),
  inputs: z.array(z.string().trim().min(1).max(80)).max(24),
  outputs: z.array(z.string().trim().min(1).max(80)).max(24),
  permissions: z.array(z.string().trim().min(1).max(80)).max(24),
  dependencies: z.array(z.string().trim().min(1).max(160)).max(24),
  validationTests: z.array(z.string().trim().min(1).max(240)).min(1).max(24),
  activation: z.enum(["passing_tests", "explicit_review"]),
});

export type CapabilityProposal = z.infer<typeof capabilityProposalSchema>;

export const globalCapabilitySchema = capabilityProposalSchema.extend({
  id: z.string().uuid(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  state: z.enum(["draft", "testing", "active", "rejected"]),
  sourceJobId: z.string().min(1),
  sourcePrompt: z.string().min(1).max(8_000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GlobalCapability = z.infer<typeof globalCapabilitySchema>;
