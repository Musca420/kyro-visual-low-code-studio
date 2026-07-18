import { describe, expect, it } from "vitest";
import { generateCodeModule, runCodeModule, testCodeModule, type CodeModule } from "../src/codeModules";

const module: CodeModule = { id: "clean", name: "Pulisci", description: "", inputType: "string", outputType: "string", operation: "trim", config: {}, tests: [{ id: "case", input: " prova ", expected: "prova" }] };

describe("moduli di codice protetti", () => {
  it("esegue e verifica la stessa trasformazione tipizzata usata dal flow", () => {
    expect(runCodeModule(module, " prova ")).toBe("prova");
    expect(testCodeModule(module)).toEqual([{ id: "case", passed: true, actual: "prova" }]);
  });

  it("genera un'estensione TypeScript leggibile senza eval", () => {
    const source = generateCodeModule(module);
    expect(source).toContain("export function run(value: Input): Output");
    expect(source).toContain(".trim()");
    expect(source).not.toMatch(/\beval\b|new Function/);
  });
});
