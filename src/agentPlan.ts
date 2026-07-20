import { z } from "zod";
import { operationNameSet, type KyroOperation } from "./agentRegistry";
import { capabilityProposalSchema } from "./globalCapability";
import { flowNodeTypes } from "./model";

const flowNodeTypeSet = new Set<string>(flowNodeTypes);
const nativeActionSet = new Set(["camera:takePhoto", "camera:pickImage", "barcode:scanQr", "barcode:scanBarcode", "location:getCurrentPosition", "location:openMap", "bluetooth:requestDevice", "bluetooth:scan", "bluetooth:connect", "bluetooth:disconnect", "bluetooth:read", "bluetooth:write", "device:getInfo", "device:getBattery", "network:getStatus", "haptics:impact", "haptics:vibrate", "share:share", "clipboard:write", "clipboard:read", "files:writeFile", "files:readFile", "files:deleteFile", "motion:getOrientation", "push:register"]);

const operationSchema = z.object({
  type: z.string().refine((value) => operationNameSet.has(value), "Unsupported Kyro operation"),
  pageId: z.string().nullable(),
  argsJson: z.string().min(2),
});

const planSchema = z.object({
  summary: z.string().min(1),
  skill: z.string().min(1),
  operations: z.array(operationSchema).max(50),
  checks: z.array(z.string()),
  confirmations: z.array(z.string()),
  alreadySatisfied: z.boolean(),
  capabilityProposal: capabilityProposalSchema.nullable(),
}).superRefine((plan, context) => {
  if (!plan.operations.length && !plan.capabilityProposal && !plan.alreadySatisfied)
    context.addIssue({ code: "custom", path: ["operations"], message: "A plan needs operations, a global capability proposal, or an already-satisfied result" });
  if (plan.alreadySatisfied && (plan.operations.length > 0 || plan.capabilityProposal))
    context.addIssue({ code: "custom", path: ["alreadySatisfied"], message: "An already-satisfied plan cannot also change the project" });
});

export type AgentPlan = Omit<z.infer<typeof planSchema>, "operations"> & { operations: KyroOperation[] };

export function parseAgentPlan(value: string): AgentPlan | undefined {
  try {
    const parsed = planSchema.parse(JSON.parse(value));
    return {
      ...parsed,
      operations: parsed.operations.map(({ argsJson, pageId, ...operation }) => {
        const args = JSON.parse(argsJson);
        if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Operation arguments must be a JSON object");
        if (operation.type === "add_flow_node") {
          const node = (args as Record<string, unknown>).node as Record<string, unknown> | undefined;
          if (!node || !flowNodeTypeSet.has(String(node.type ?? ""))) throw new Error("Unsupported visual flow node type");
          const config = node.config as Record<string, unknown> | undefined;
          if (node.type === "nativeAction" && !nativeActionSet.has(`${String(config?.capability ?? "")}:${String(config?.action ?? "")}`)) throw new Error("Unsupported native capability action");
        }
        if (operation.type === "connect_nodes" && ![undefined, "success", "error"].includes((args as Record<string, unknown>).path as string | undefined))
          throw new Error("Flow edges must use success or error paths");
        return { ...operation, ...(pageId ? { pageId } : {}), args } as KyroOperation;
      }),
    };
  }
  catch { return undefined; }
}
