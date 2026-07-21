import { describe, expect, it } from "vitest";
import type { AgentPlan } from "../src/agentPlan";
import { summarizeAgentPlan } from "../src/changeSummary";

describe("plain-language change summary", () => {
  it("derives impact only from typed operations", () => {
    const plan: AgentPlan = {
      summary: "Build and connect a task list",
      skill: "kyro-app",
      operations: [
        { type: "add_component", pageId: "home", args: { componentType: "list" } },
        { type: "create_data_source", pageId: "home", args: { name: "Tasks" } },
        { type: "create_flow", pageId: "home", args: { name: "Load tasks" } },
        { type: "set_export_config", pageId: "home", args: { target: "pwa" } },
      ],
      checks: ["Preview loads", "Export builds"],
      confirmations: ["Change export target"],
      alreadySatisfied: false,
      capabilityProposal: null,
    };
    expect(summarizeAgentPlan(plan)).toEqual({
      changes: ["Add a visual element", "Create a data source", "Create an interaction", "Update export settings"],
      areas: [{ name: "Design", count: 1 }, { name: "Data", count: 1 }, { name: "Interactions", count: 1 }, { name: "App settings", count: 1 }],
      checkCount: 2,
      requiresConfirmation: true,
    });
  });
});

