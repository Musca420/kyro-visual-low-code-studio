import { makeComponent, type EditorComponent, type ReusableComponent } from "./model";

export function createReusableComponent(
  name: string,
  components: EditorComponent[],
): ReusableComponent {
  const ids = new Set(components.map((component) => component.id));
  const snapshots = components.map((component) => ({
    ...component,
    parentId: component.parentId && ids.has(component.parentId) ? component.parentId : undefined,
    events: {},
    binding: undefined,
  }));
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    components: snapshots,
    exposedProperties: snapshots
      .filter((component) => typeof component.props.label === "string")
      .map((component) => ({
        componentId: component.id,
        property: "label" as const,
        label: `${component.name} · Testo`,
      })),
  };
}

export function instantiateReusableComponent(definition: ReusableComponent) {
  const wrapper = makeComponent("reusable");
  wrapper.name = definition.name;
  wrapper.props = { ...wrapper.props, label: definition.name, definitionId: definition.id };
  wrapper.accessibility.label = definition.name;
  wrapper.styles.desktop = {
    ...wrapper.styles.desktop,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  };
  const ids = new Map(definition.components.map((component) => [component.id, crypto.randomUUID()]));
  const components = definition.components.map((component) => {
    const root = !component.parentId;
    return {
      ...component,
      id: ids.get(component.id)!,
      name: `${component.name} · ${definition.name}`,
      parentId: component.parentId ? ids.get(component.parentId) : wrapper.id,
      styles: root
        ? {
            ...component.styles,
            desktop: {
              ...component.styles.desktop,
              position: "relative" as const,
              left: "0px",
              top: "0px",
              marginLeft: "0px",
              marginTop: "0px",
            },
          }
        : component.styles,
      events: {},
      binding: undefined,
    };
  });
  return { wrapper, components };
}
