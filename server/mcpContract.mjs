const access = (values = {}) => Object.freeze({
  read: false, write: false, verify: false, build: false, plan: false,
  filesystem: false, network: "loopback", shell: false, ...values,
});

export const kyroMcpContracts = Object.freeze({
  kyro_describe_tools: { access: access({ read: true }), output: "mcp-contract-registry@1", sideEffects: [] },
  kyro_get_context: { access: access({ read: true }), output: "indexed-agent-context@1", sideEffects: [] },
  kyro_plan: { access: access({ read: true, plan: true }), output: "capability-resolution@1", sideEffects: [] },
  kyro_resolve_capability: { access: access({ read: true, plan: true }), output: "capability-resolution@1", sideEffects: [] },
  kyro_apply_operations: { access: access({ write: true }), output: "project-transaction-result@1", sideEffects: ["graph_transaction"] },
  kyro_apply_verified_transaction: { access: access({ read: true, write: true, verify: true }), output: "verified-transaction-capture@1", sideEffects: ["graph_transaction", "preview_capture"] },
  kyro_register_global_capability: { access: access({ write: true }), output: "capability-draft@1", sideEffects: ["capability_draft"] },
  kyro_validate: { access: access({ read: true, verify: true }), output: "graph-validation@1", sideEffects: [] },
  kyro_verify: { access: access({ read: true, verify: true }), output: "verification-report@1", sideEffects: [] },
  kyro_build_preflight: { access: access({ read: true, verify: true, build: true }), output: "build-preflight@1", sideEffects: [] },
  kyro_capture_preview: { access: access({ read: true, verify: true }), output: "preview-capture@1", sideEffects: ["preview_navigation", "preview_capture"] },
  kyro_undo: { access: access({ write: true, verify: true }), output: "project-transaction-result@1", sideEffects: ["graph_transaction"] },
});

export const kyroMcpContractVersion = 1;

export function kyroMcpMeta(name) {
  const contract = kyroMcpContracts[name];
  if (!contract) throw new Error(`Missing MCP contract for ${name}`);
  return {
    "kyro/contractVersion": kyroMcpContractVersion,
    "kyro/access": contract.access,
    "kyro/output": contract.output,
    "kyro/sideEffects": contract.sideEffects,
    "kyro/authorization": "active_job_project_revision",
  };
}
