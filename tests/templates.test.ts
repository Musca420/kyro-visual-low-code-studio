import { describe, expect, it } from "vitest";
import { parseProject } from "../src/model";
import { createTemplateProject, templateCatalog } from "../src/templates";

describe("catalogo template", () => {
  it("offre tutti i punti di partenza richiesti come progetti validi e modificabili", () => {
    expect(templateCatalog.map((template) => template.id)).toEqual([
      "landing",
      "portfolio",
      "company",
      "blog",
      "ecommerce",
      "dashboard",
      "auth",
      "management",
      "mobile",
    ]);
    for (const template of templateCatalog) {
      const project = parseProject(
        createTemplateProject(template.id, `Test ${template.name}`),
      );
      expect(project.pages.length).toBeGreaterThan(0);
      expect(project.pages.every((page) => page.components.length >= 4)).toBe(
        true,
      );
    }
  });

  it("crea i template informativi come siti multipagina responsive", () => {
    const project = createTemplateProject("portfolio", "Portfolio prova");
    expect(project.pages).toHaveLength(4);
    expect(
      project.pages[0].components.some(
        (component) => component.styles.mobile.width === "100%",
      ),
    ).toBe(true);
  });
});
