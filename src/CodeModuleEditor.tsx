import { useState } from "react";
import { formatModuleValue, parseModuleValue, runCodeModule, testCodeModule, type CodeModule } from "./codeModules";

const operationTypes: Record<CodeModule["operation"], [CodeModule["inputType"], CodeModule["outputType"]]> = {
  trim: ["string", "string"], uppercase: ["string", "string"], lowercase: ["string", "string"],
  template: ["unknown", "string"], pick: ["record", "unknown"], count: ["list", "number"],
};

export function CodeModuleEditor({ module, onChange }: { module: CodeModule; onChange: (module: CodeModule) => void }) {
  const [result, setResult] = useState("");
  const test = module.tests[0] ?? { id: crypto.randomUUID(), input: " prova ", expected: "prova" };
  const patchTest = (patch: Partial<typeof test>) => onChange({ ...module, tests: [{ ...test, ...patch }] });
  return <section className="code-module-editor" aria-label="Modulo di codice protetto">
    <p>Funzione tipizzata, verificabile e senza esecuzione arbitraria nell’editor.</p>
    <label>Nome modulo<input aria-label="Nome modulo" value={module.name} onChange={(event) => onChange({ ...module, name: event.target.value })} /></label>
    <label>Operazione<select aria-label="Operazione modulo" value={module.operation} onChange={(event) => {
      const operation = event.target.value as CodeModule["operation"], [inputType, outputType] = operationTypes[operation];
      onChange({ ...module, operation, inputType, outputType });
    }}><option value="trim">Rimuovi spazi</option><option value="uppercase">Maiuscolo</option><option value="lowercase">Minuscolo</option><option value="template">Componi testo</option><option value="pick">Leggi campo</option><option value="count">Conta elementi</option></select></label>
    {module.operation === "template" && <label>Modello di testo<input aria-label="Modello di testo" value={module.config.template ?? "{{value}}"} onChange={(event) => onChange({ ...module, config: { ...module.config, template: event.target.value } })} /></label>}
    {module.operation === "pick" && <label>Campo da leggere<input aria-label="Campo modulo" value={module.config.field ?? ""} onChange={(event) => onChange({ ...module, config: { ...module.config, field: event.target.value } })} /></label>}
    <span className="module-signature">{module.inputType} → {module.outputType}</span>
    <fieldset><legend>Test del modulo</legend>
      <label>Valore in ingresso<input aria-label="Input test modulo" value={test.input} onChange={(event) => patchTest({ input: event.target.value })} /></label>
      <label>Risultato atteso<input aria-label="Risultato atteso modulo" value={test.expected} onChange={(event) => patchTest({ expected: event.target.value })} /></label>
      <button type="button" className="secondary" onClick={() => {
        if (!module.tests.length) onChange({ ...module, tests: [test] });
        const checked = testCodeModule({ ...module, tests: [test] })[0];
        setResult(checked.passed ? `Test superato: ${checked.actual}` : `Atteso ${test.expected}, ottenuto ${checked.actual}`);
      }}>Esegui test</button>
      {result && <output className={result.startsWith("Test superato") ? "module-test-pass" : "flow-connection-error"}>{result}</output>}
    </fieldset>
    <button type="button" className="secondary" onClick={() => {
      try { setResult(`Output: ${formatModuleValue(runCodeModule(module, parseModuleValue(test.input, module.inputType)))}`); }
      catch (error) { setResult(error instanceof Error ? error.message : String(error)); }
    }}>Prova ora</button>
  </section>;
}
