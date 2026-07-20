export const operationDefinitions = [
  ["add_page", "app"], ["update_page", "app"], ["remove_page", "app", true],
  ["add_component", "design"], ["compose_screen", "design"], ["move_component", "design"], ["resize_component", "design"], ["reorder_component", "design"], ["wrap_component", "design"], ["remove_component", "design", true],
  ["set_component_property", "design"], ["set_component_style", "design"], ["set_responsive_style", "design"], ["set_component_state_style", "design"], ["set_component_accessibility", "design"], ["set_component_intent", "design"],
  ["create_flow", "actions"], ["compose_record_action", "actions"], ["compose_native_action", "actions"], ["add_flow", "actions"], ["update_flow", "actions"], ["remove_flow", "actions", true], ["add_flow_node", "actions"], ["update_flow_node", "actions"], ["remove_flow_node", "actions"], ["connect_nodes", "actions"], ["remove_flow_edge", "actions"], ["set_component_event", "actions"], ["remove_component_event", "actions"],
  ["create_data_source", "data"], ["update_data_source", "data"], ["remove_data_source", "data", true], ["bind_component_data", "data"],
  ["create_code_module", "extensions"], ["update_code_module", "extensions"], ["remove_code_module", "extensions", true],
  ["set_theme_token", "design"], ["set_project_property", "app"], ["set_app_config", "app"], ["set_export_config", "publish"],
  ["approve_dependency", "extensions", true], ["revoke_dependency", "extensions", true],
] as const;

export type KyroOperationType = typeof operationDefinitions[number][0];
export type KyroOperationDomain = typeof operationDefinitions[number][1];
export type KyroOperation = { type: KyroOperationType; pageId?: string; args: Record<string, unknown> };

export const operationNames = operationDefinitions.map(([name]) => name) as KyroOperationType[];
export const operationNameSet = new Set<string>(operationNames);
export const operationPrompt = operationNames.join(", ");

export function operationRequiresConfirmation(type: string) {
  return operationDefinitions.some(([name, , confirmation]) => name === type && confirmation === true);
}
