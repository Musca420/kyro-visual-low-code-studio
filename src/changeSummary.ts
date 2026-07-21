import type { AgentPlan } from "./agentPlan";

const labels: Record<string, string> = {
  add_page: "Add a page", update_page: "Update a page", remove_page: "Remove a page",
  add_component: "Add a visual element", compose_screen: "Build a screen", move_component: "Move an element",
  resize_component: "Resize an element", reorder_component: "Reorder an element", wrap_component: "Group an element",
  remove_component: "Remove an element", set_component_property: "Change content", set_component_style: "Change appearance",
  set_responsive_style: "Adjust responsive design", set_component_state_style: "Style an interaction state",
  set_component_accessibility: "Improve accessibility", set_component_intent: "Describe element intent",
  create_flow: "Create an interaction", compose_record_action: "Create a record action", compose_collection_filter: "Connect collection filters", compose_native_action: "Create a device action",
  add_flow: "Add an interaction", update_flow: "Update an interaction", remove_flow: "Remove an interaction",
  add_flow_node: "Add an action step", update_flow_node: "Update an action step", remove_flow_node: "Remove an action step",
  connect_nodes: "Connect action steps", remove_flow_edge: "Disconnect action steps", set_component_event: "Connect an event",
  remove_component_event: "Disconnect an event", create_data_source: "Create a data source", update_data_source: "Update a data source",
  remove_data_source: "Remove a data source", bind_component_data: "Connect data to an element", create_code_module: "Create a confined module",
  update_code_module: "Update a confined module", remove_code_module: "Remove a confined module", set_theme_token: "Change the theme",
  set_project_property: "Update project details", set_app_config: "Update app settings", set_export_config: "Update export settings",
  approve_dependency: "Approve an exact dependency", revoke_dependency: "Revoke a dependency approval",
};

const areaFor = (operation: string) => operation.includes("flow") || operation.includes("event") || operation.includes("action") || operation.includes("module")
  ? "Interactions"
  : operation.includes("data_source") || operation.startsWith("bind_")
    ? "Data"
    : operation.includes("app_config") || operation.includes("export") || operation.includes("dependency") || operation.includes("project_property")
      ? "App settings"
      : "Design";

export function summarizeAgentPlan(plan: AgentPlan) {
  const areaCounts = new Map<string, number>();
  const changes = plan.operations.map((operation) => {
    const area = areaFor(operation.type);
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
    return labels[operation.type] ?? "Update the visual project";
  });
  return {
    changes,
    areas: [...areaCounts].map(([name, count]) => ({ name, count })),
    checkCount: plan.checks.length,
    requiresConfirmation: plan.confirmations.length > 0,
  };
}

