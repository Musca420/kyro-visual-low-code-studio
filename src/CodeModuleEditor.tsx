import { useState } from "react";
import { formatModuleValue, parseModuleValue, runCodeModule, testCodeModule, type CodeModule } from "./codeModules";

const operationTypes: Record<CodeModule["operation"], [CodeModule["inputType"], CodeModule["outputType"]]> = {
  trim: ["string", "string"], uppercase: ["string", "string"], lowercase: ["string", "string"],
  template: ["unknown", "string"], pick: ["record", "unknown"], count: ["list", "number"],
};

export function CodeModuleEditor({ module, onChange }: { module: CodeModule; onChange: (module: CodeModule) => void }) {
  const [result, setResult] = useState("");
  const test = module.tests[0] ?? { id: crypto.randomUUID(), input: " example ", expected: "example" };
  const patchTest = (patch: Partial<typeof test>) => onChange({ ...module, tests: [{ ...test, ...patch }] });
  return <section className="code-module-editor" aria-label="Protected code module">
    <p>A typed, verifiable function without arbitrary execution in the editor.</p>
    <label>Module name<input aria-label="Module name" value={module.name} onChange={(event) => onChange({ ...module, name: event.target.value })} /></label>
    <label>Operation<select aria-label="Module operation" value={module.operation} onChange={(event) => {
      const operation = event.target.value as CodeModule["operation"], [inputType, outputType] = operationTypes[operation];
      onChange({ ...module, operation, inputType, outputType });
    }}><option value="trim">Trim spaces</option><option value="uppercase">Uppercase</option><option value="lowercase">Lowercase</option><option value="template">Compose text</option><option value="pick">Read field</option><option value="count">Count items</option></select></label>
    {module.operation === "template" && <label>Text template<input aria-label="Text template" value={module.config.template ?? "{{value}}"} onChange={(event) => onChange({ ...module, config: { ...module.config, template: event.target.value } })} /></label>}
    {module.operation === "pick" && <label>Field to read<input aria-label="Module field" value={module.config.field ?? ""} onChange={(event) => onChange({ ...module, config: { ...module.config, field: event.target.value } })} /></label>}
    <span className="module-signature">{module.inputType} → {module.outputType}</span>
    <fieldset><legend>Module test</legend>
      <label>Input value<input aria-label="Module test input" value={test.input} onChange={(event) => patchTest({ input: event.target.value })} /></label>
      <label>Expected result<input aria-label="Expected module result" value={test.expected} onChange={(event) => patchTest({ expected: event.target.value })} /></label>
      <button type="button" className="secondary" onClick={() => {
        if (!module.tests.length) onChange({ ...module, tests: [test] });
        const checked = testCodeModule({ ...module, tests: [test] })[0];
        setResult(checked.passed ? `Test passed: ${checked.actual}` : `Expected ${test.expected}, received ${checked.actual}`);
      }}>Run test</button>
      {result && <output className={result.startsWith("Test passed") ? "module-test-pass" : "flow-connection-error"}>{result}</output>}
    </fieldset>
    <button type="button" className="secondary" onClick={() => {
      try { setResult(`Output: ${formatModuleValue(runCodeModule(module, parseModuleValue(test.input, module.inputType)))}`); }
      catch (error) { setResult(error instanceof Error ? error.message : String(error)); }
    }}>Try now</button>
  </section>;
}
