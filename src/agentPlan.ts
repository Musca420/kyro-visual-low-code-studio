import { z } from "zod";
import { operationEntries, operationNameSet, operationPlatforms, validateOperationArguments, type KyroOperation, type KyroOperationType } from "./agentRegistry";
import { capabilityProposalSchema } from "./globalCapability";
import { componentTypes, flowNodeTypes } from "./model";
import { nativeCapabilities } from "./nativeCapabilities";

const flowNodeTypeSet = new Set<string>(flowNodeTypes);
const nativeActionSet = new Set(nativeCapabilities.flatMap((capability) => capability.actions.map((action) => `${capability.id}:${action.id}`)));

export const planRequirementSchema = z.object({
  kind: z.enum(["operation", "capability", "effect"]),
  id: z.string().trim().min(1).max(160),
});

const operationPlanSchemas = operationEntries.map(([type, definition]) => z.object({
  type: z.literal(type), pageId: z.string().nullable(), args: definition.args,
}));
const operationPlanSchema = z.union(operationPlanSchemas as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]]) as z.ZodType<KyroOperation>;

export const agentPlanSchema = z.object({
  summary: z.string().min(1),
  skill: z.string().min(1),
  requirements: z.array(planRequirementSchema).max(50),
  targetPlatforms: z.array(z.enum(operationPlatforms)).min(1).max(operationPlatforms.length),
  operations: z.array(operationPlanSchema).max(50),
  checks: z.array(z.string()),
  confirmations: z.array(z.string()),
  alreadySatisfied: z.boolean(),
  capabilityProposal: capabilityProposalSchema.nullable(),
}).superRefine((plan, context) => {
  if (!plan.operations.length && !plan.capabilityProposal && !plan.alreadySatisfied)
    context.addIssue({ code: "custom", path: ["operations"], message: "A plan needs operations, a global capability proposal, or an already-satisfied result" });
  if (plan.alreadySatisfied && (plan.operations.length > 0 || plan.capabilityProposal))
    context.addIssue({ code: "custom", path: ["alreadySatisfied"], message: "An already-satisfied plan cannot also change the project" });
  const requiredOperations = new Set(plan.requirements.filter((item) => item.kind === "operation").map((item) => item.id));
  for (const operation of plan.operations) if (!requiredOperations.has(operation.type))
    context.addIssue({ code: "custom", path: ["requirements"], message: `Operation ${operation.type} needs an explicit typed requirement` });
});

export const agentPlanJsonSchema = z.toJSONSchema(agentPlanSchema, { target: "draft-7", unrepresentable: "any", reused: "inline" });
export type AgentPlan = Omit<z.infer<typeof agentPlanSchema>, "operations"> & { operations: KyroOperation[] };

function validateSpecializedOperation(type: KyroOperationType, args: Record<string, unknown>) {
  if (type === "add_component" && !componentTypes.includes(String(args.componentType) as typeof componentTypes[number])) throw new Error("Unsupported visual component type");
  if (type === "add_flow_node") {
    const node = args.node as Record<string, unknown> | undefined;
    if (!node || !flowNodeTypeSet.has(String(node.type ?? ""))) throw new Error("Unsupported visual flow node type");
    const config = node.config as Record<string, unknown> | undefined;
    if (node.type === "nativeAction" && !nativeActionSet.has(`${String(config?.capability ?? "")}:${String(config?.action ?? "")}`)) throw new Error("Unsupported native capability action");
  }
}

export function parseAgentPlan(value: string): AgentPlan | undefined {
  try {
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const input = JSON.parse(fenced?.trim() || value.trim()) as Record<string, unknown>;
    input.skill = Array.isArray(input.skill)
      ? input.skill.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).join(" + ")
      : input.skill ?? "kyro-live-context";
    input.checks ??= Array.isArray(input.observableCriteria) ? input.observableCriteria : [];
    input.confirmations = Array.isArray(input.confirmations)
      ? input.confirmations.flatMap((item) => typeof item === "string" ? [item] : item && typeof item === "object" && typeof (item as Record<string, unknown>).message === "string" ? [String((item as Record<string, unknown>).message)] : [])
      : [];
    const rawOperations = Array.isArray(input.operations) ? input.operations as Record<string, unknown>[] : [];
    const legacy = rawOperations.some((operation) => typeof operation.argsJson === "string");
    if (legacy) {
      input.operations = rawOperations.map(({ argsJson, ...operation }) => ({ ...operation, args: JSON.parse(String(argsJson)) }));
      input.requirements ??= rawOperations.map((operation) => ({ kind: "operation", id: String(operation.type) }));
      input.targetPlatforms ??= ["web"];
    }
    const parsed = agentPlanSchema.parse(input);
    const operations = parsed.operations.map((operation) => {
      const type = operation.type as KyroOperationType;
      if (!operationNameSet.has(type)) throw new Error("Unsupported Kyro operation");
      const args = validateOperationArguments(type, operation.args);
      validateSpecializedOperation(type, args);
      return { type, ...(operation.pageId ? { pageId: operation.pageId } : {}), args } as KyroOperation;
    });
    return { ...parsed, operations } as AgentPlan;
  } catch { return undefined; }
}
