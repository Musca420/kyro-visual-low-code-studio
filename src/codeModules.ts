import type { Project } from "./model";

export type CodeModule = Project["codeModules"][number];

export function runCodeModule(module: CodeModule, value: unknown): unknown {
  if (module.operation === "trim") return String(value ?? "").trim();
  if (module.operation === "uppercase") return String(value ?? "").toUpperCase();
  if (module.operation === "lowercase") return String(value ?? "").toLowerCase();
  if (module.operation === "template")
    return (module.config.template || "{{value}}").replaceAll("{{value}}", String(value ?? ""));
  if (module.operation === "pick") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Il modulo richiede un record");
    return (value as Record<string, unknown>)[module.config.field || ""];
  }
  if (module.operation === "count") {
    if (!Array.isArray(value)) throw new Error("Il modulo richiede un elenco");
    return value.length;
  }
  throw new Error("Operazione modulo non supportata");
}

export function parseModuleValue(value: string, type: CodeModule["inputType"]): unknown {
  if (type === "string" || type === "unknown") return value;
  if (type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error("Inserisci un numero valido");
    return number;
  }
  try {
    const parsed = JSON.parse(value);
    if (type === "list" && !Array.isArray(parsed)) throw new Error("A JSON list is required");
    if (type === "record" && (!parsed || typeof parsed !== "object" || Array.isArray(parsed))) throw new Error("A JSON object is required");
    return parsed;
  } catch (error) {
    throw error instanceof SyntaxError ? new Error("Invalid JSON") : error;
  }
}

export function formatModuleValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function testCodeModule(module: CodeModule) {
  return module.tests.map((test) => {
    try {
      const actual = formatModuleValue(runCodeModule(module, parseModuleValue(test.input, module.inputType)));
      return { id: test.id, passed: actual === test.expected, actual };
    } catch (error) {
      return { id: test.id, passed: false, actual: error instanceof Error ? error.message : String(error) };
    }
  });
}

export function generateCodeModule(module: CodeModule) {
  const config = JSON.stringify(module.config);
  return `// Protected extension generated from the graph. Edit this file outside Kyro without changing the visual project.\nexport type Input = ${tsType(module.inputType)}\nexport type Output = ${tsType(module.outputType)}\nconst config: Record<string, string> = ${config}\nexport function run(value: Input): Output {\n  ${operationSource(module.operation)}\n}\n`;
}

const tsType = (type: CodeModule["inputType"]) => ({ unknown: "unknown", string: "string", number: "number", record: "Record<string, unknown>", list: "unknown[]" })[type];

const operationSource = (operation: CodeModule["operation"]) => ({
  trim: "return String(value ?? '').trim() as Output",
  uppercase: "return String(value ?? '').toUpperCase() as Output",
  lowercase: "return String(value ?? '').toLowerCase() as Output",
  template: "return (config.template || '{{value}}').replaceAll('{{value}}', String(value ?? '')) as Output",
  pick: "if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Il modulo richiede un record'); return (value as Record<string, unknown>)[config.field || ''] as Output",
  count: "if (!Array.isArray(value)) throw new Error('Il modulo richiede un elenco'); return value.length as Output",
})[operation];
