import { describe, expect, it } from "vitest";
import { makeComponent } from "../src/model";
import { createReusableComponent, instantiateReusableComponent } from "../src/reusableComponents";

describe("componenti riutilizzabili", () => {
  it("salva un albero visuale e ne crea copie native con ID nuovi", () => {
    const card = makeComponent("card");
    const title = makeComponent("title");
    title.parentId = card.id;
    title.props.label = "Titolo originale";
    title.events.click = "flow-originale";
    const definition = createReusableComponent("Feature card", [card, title]);
    const first = instantiateReusableComponent(definition);
    const second = instantiateReusableComponent(definition);

    expect(definition.exposedProperties).toContainEqual({
      componentId: title.id,
      property: "label",
      label: `${title.name} · Testo`,
    });
    expect(first.wrapper.type).toBe("reusable");
    expect(first.components[1].parentId).toBe(first.components[0].id);
    expect(first.components[1].events).toEqual({});
    expect(new Set([...first.components, first.wrapper, ...second.components, second.wrapper].map((item) => item.id)).size).toBe(6);
  });
});
