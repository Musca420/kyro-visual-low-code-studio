import { useState } from "react";
import { canContain, componentPath, descendantIds } from "./hierarchy";
import type { Breakpoint, EditorComponent } from "./model";
import { visualGradients, visualPalettes } from "./visualPresets";

type Props = {
  component: EditorComponent;
  components: EditorComponent[];
  assets: Array<{ id: string; name: string; url: string }>;
  breakpoint: Breakpoint;
  onUpdate: (update: (component: EditorComponent) => EditorComponent) => void;
  onReparent: (parentId?: string) => void;
  onWrap: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};
type Style = EditorComponent["styles"]["desktop"];
type State = "base" | keyof EditorComponent["states"];

const shadows = {
  None: "none",
  Soft: "0 10px 30px #1720331f",
  Medium: "0 16px 42px #1720332b",
  Strong: "0 24px 70px #1720333d",
};
const animations = {
  None: "none",
  Fade: "fe-fade 500ms ease both",
  Rise: "fe-rise 500ms ease both",
  Pulse: "fe-pulse 1.4s ease-in-out infinite",
  Float: "fe-float 2.4s ease-in-out infinite",
};
export function VisualProperties({
  component,
  components,
  assets,
  breakpoint,
  onUpdate,
  onReparent,
  onWrap,
  onDuplicate,
  onDelete,
}: Props) {
  const [state, setState] = useState<State>("base");
  const [advanced, setAdvanced] = useState(false);
  const base = {
    ...component.styles.desktop,
    ...(breakpoint === "desktop" ? {} : component.styles[breakpoint]),
  };
  const style =
    state === "base" ? base : { ...base, ...component.states[state] };
  const setStyle = (key: keyof Style, value: string) =>
    onUpdate((item) =>
      state === "base"
        ? {
            ...item,
            styles: {
              ...item.styles,
              [breakpoint]: { ...item.styles[breakpoint], [key]: value },
            },
          }
        : {
            ...item,
            states: {
              ...item.states,
              [state]: { ...item.states[state], [key]: value },
            },
          },
    );
  const setStyles = (values: Partial<Style>) =>
    onUpdate((item) =>
      state === "base"
        ? {
            ...item,
            styles: {
              ...item.styles,
              [breakpoint]: { ...item.styles[breakpoint], ...values },
            },
          }
        : {
            ...item,
            states: {
              ...item.states,
              [state]: { ...item.states[state], ...values },
            },
          },
    );
  const setBaseStyles = (values: Partial<Style>) =>
    onUpdate((item) => ({
      ...item,
      styles: {
        ...item.styles,
        [breakpoint]: { ...item.styles[breakpoint], ...values },
      },
    }));
  const excluded = descendantIds(components, component.id);
  excluded.add(component.id);
  const containers = components.filter(
    (item) => canContain(item) && !excluded.has(item.id),
  );
  const field = (label: string, key: keyof Style, help?: string) => (
    <label data-help={help}>
      {label}
      <input
        value={style[key]}
        onChange={(event) => setStyle(key, event.target.value)}
      />
    </label>
  );
  const select = (
    label: string,
    key: keyof Style,
    options: readonly string[],
    help?: string,
  ) => (
    <label data-help={help}>
      {label}
      <select
        value={style[key]}
        onChange={(event) => setStyle(key, event.target.value)}
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
  const color = (label: string, key: keyof Style) => (
    <label>
      {label}
      <span className="color-field">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(style[key]) ? style[key] : "#ffffff"}
          onChange={(event) => setStyle(key, event.target.value)}
        />
        <input
          aria-label={`${label} value`}
          value={style[key]}
          onChange={(event) => setStyle(key, event.target.value)}
        />
      </span>
    </label>
  );
  return (
    <div className={`properties visual-properties ${advanced ? "advanced" : "simple"}`}>
      <div className="property-mode" aria-label="Property level">
        <button className={!advanced ? "active" : ""} onClick={() => setAdvanced(false)}>
          Essential
        </button>
        <button className={advanced ? "active" : ""} onClick={() => setAdvanced(true)}>
          Advanced
        </button>
      </div>
      <label>
        Element name
        <input
          value={component.name}
          onChange={(event) =>
            onUpdate((item) => ({ ...item, name: event.target.value }))
          }
        />
      </label>
      <label>
        Text or label
        <input
          value={String(component.props.label ?? "")}
          onChange={(event) =>
            onUpdate((item) => ({
              ...item,
              props: { ...item.props, label: event.target.value },
              accessibility: {
                ...item.accessibility,
                label: event.target.value,
              },
            }))
          }
        />
      </label>
      {["input", "textarea", "select", "checkbox", "radio", "calendar", "signature"].includes(component.type) && (
        <label>
          Data field name
          <input
            value={String(component.props.fieldName ?? "")}
            placeholder="e.g. email, budget, status"
            onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, fieldName: event.target.value } }))}
          />
        </label>
      )}
      {component.type === "input" && (
        <><label>Field type<select value={String(component.props.inputType ?? "text")} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, inputType: event.target.value } }))}><option value="text">Text</option><option value="email">Email</option><option value="number">Number</option><option value="password">Password</option><option value="search">Search</option><option value="date">Date</option></select></label><label>Placeholder<input value={String(component.props.placeholder ?? "")} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, placeholder: event.target.value } }))} /></label></>
      )}
      {component.type === "button" && <label>Button behavior<select value={String(component.props.buttonType ?? "button")} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, buttonType: event.target.value } }))}><option value="button">Standard action</option><option value="submit">Submit form</option><option value="reset">Reset form</option></select></label>}
      <details className="intent-properties">
        <summary>Meaning in the program</summary>
        <div className="property-section">
          <p className="property-help">
            Describe the outcome, not the code. Flow, data, and Codex use
            this meaning to keep the element consistent.
          </p>
          {(
            [
              ["Role", "role", "Example: primary action"],
              ["Action", "action", "Example: create athlete"],
              ["Entity", "entity", "Example: Athlete"],
              ["Expected result", "expectedResult", "Example: a new athlete in the list"],
            ] as const
          ).map(([label, key, placeholder]) => (
            <label key={key}>
              {label}
              <input
                value={component.intent[key]}
                placeholder={placeholder}
                onChange={(event) =>
                  onUpdate((item) => ({
                    ...item,
                    intent: { ...item.intent, [key]: event.target.value },
                  }))
                }
              />
            </label>
          ))}
          <fieldset className="intent-states">
            <legend>Required states</legend>
            {(["loading", "success", "error"] as const).map((value) => (
              <label className="check-row" key={value}>
                <input
                  type="checkbox"
                  checked={component.intent.requiredStates.includes(value)}
                  onChange={(event) =>
                    onUpdate((item) => ({
                      ...item,
                      intent: {
                        ...item.intent,
                        requiredStates: event.target.checked
                          ? [...item.intent.requiredStates, value]
                          : item.intent.requiredStates.filter((state) => state !== value),
                      },
                    }))
                  }
                />
                {value}
              </label>
            ))}
          </fieldset>
          <label>
            Required permissions
            <input
              value={component.intent.permissions.join(", ")}
              placeholder="Example: camera, notifications"
              onChange={(event) =>
                onUpdate((item) => ({
                  ...item,
                  intent: {
                    ...item.intent,
                    permissions: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  },
                }))
              }
            />
          </label>
          <label>
            Connected service
            <select
              aria-label="Required capability"
              value={component.intent.capabilityIds?.[0] ?? ""}
              onChange={(event) => onUpdate((item) => ({
                ...item,
                intent: { ...item.intent, capabilityIds: event.target.value ? [event.target.value] : [] },
              }))}
            >
              <option value="">No external service</option>
              <option value="authentication.user">User accounts</option>
              <option value="payments.checkout">Payments / checkout</option>
              <option value="notifications.local">Local notifications</option>
              <option value="notifications.push">Push notifications</option>
            </select>
          </label>
        </div>
      </details>
      {["image", "audio", "video"].includes(component.type) && (
        <label>
          Project file
          <select
            value={String(component.props.src ?? "")}
            onChange={(event) =>
              onUpdate((item) => ({
                ...item,
                props: { ...item.props, src: event.target.value },
              }))
            }
          >
            <option value="">Placeholder</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.url}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label data-help="Choose the appearance you are editing. Base is always active; the others apply during interaction.">
        State to edit
        <select
          value={state}
          onChange={(event) => setState(event.target.value as State)}
        >
          <option value="base">Default</option>
          <option value="hover">Hover</option>
          <option value="focus">Keyboard focus</option>
          <option value="active">While pressed</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>
      <section className="quick-style" aria-label="Quick appearance">
        <div>
          <strong>Quick appearance</strong>
          <small>Click once to see the result immediately on the canvas.</small>
        </div>
        <div className="palette-swatches" aria-label="Ready palettes">
          {visualPalettes.map((palette) => (
            <button
              key={palette.name}
              aria-label={`Palette ${palette.name}`}
              title={palette.name}
              style={{ background: palette.background, color: palette.color }}
              onClick={() =>
                setStyles({
                  background: palette.background,
                  color: palette.color,
                  borderColor: palette.background,
                })
              }
            >
              Aa
            </button>
          ))}
        </div>
        <div className="field-pair">
          {color("Background color", "background")}
          {color("Text color", "color")}
        </div>
        <label>
          Ready gradient
          <select
            value={visualGradients.some(([, value]) => value === style.backgroundImage) ? style.backgroundImage : "none"}
            onChange={(event) => setStyle("backgroundImage", event.target.value)}
          >
            <option value="none">None</option>
            {visualGradients.map(([name, value]) => <option key={name} value={value}>{name}</option>)}
          </select>
        </label>
        {assets.length > 0 && (
          <label>
            Background image
            <select
              value={style.backgroundImage.startsWith("url(") ? style.backgroundImage : ""}
              onChange={(event) => setStyle("backgroundImage", event.target.value)}
            >
              <option value="none">None</option>
              {assets.map((asset) => <option key={asset.id} value={`url(${JSON.stringify(asset.url)})`}>{asset.name}</option>)}
            </select>
          </label>
        )}
        <div className="field-pair">
          <label>
            Font
            <select aria-label="Quick font" value={style.fontFamily} onChange={(event) => setStyle("fontFamily", event.target.value)}>
              <option value="Inter, system-ui, sans-serif">Modern</option>
              <option value="Arial, sans-serif">Essential</option>
              <option value="Georgia, serif">Editorial</option>
              <option value="ui-monospace, monospace">Technical</option>
            </select>
          </label>
          <label>
            Weight
            <select aria-label="Quick weight" value={style.fontWeight} onChange={(event) => setStyle("fontWeight", event.target.value)}>
              <option value="400">Regular</option>
              <option value="600">Bold</option>
              <option value="800">Heavy</option>
            </select>
          </label>
        </div>
        <div className="quick-align" aria-label="Text alignment">
          {(["left", "center", "right"] as const).map((value) => (
            <button
              aria-label={`Align ${value === "left" ? "left" : value === "center" ? "center" : "right"}`}
              className={style.textAlign === value ? "active" : ""}
              key={value}
              onClick={() => setStyle("textAlign", value)}
            >
              {value === "left" ? "≡" : value === "center" ? "≣" : "☰"}
            </button>
          ))}
        </div>
        <label>
          Corners <output>{Number.parseInt(style.borderRadius) || 0}px</output>
          <input
            type="range"
            aria-label="Quick corners"
            min="0"
            max="48"
            value={Number.parseInt(style.borderRadius) || 0}
            onChange={(event) => {
              const value = `${event.target.value}px`;
              setStyles({ borderRadius: value, borderTopLeftRadius: value, borderTopRightRadius: value, borderBottomRightRadius: value, borderBottomLeftRadius: value });
            }}
          />
        </label>
        <label>
          Inner spacing <output>{Number.parseInt(style.padding) || 0}px</output>
          <input
            type="range"
            aria-label="Quick inner spacing"
            min="0"
            max="80"
            value={Number.parseInt(style.padding) || 0}
            onChange={(event) => {
              const value = `${event.target.value}px`;
              setStyles({ padding: value, paddingTop: value, paddingRight: value, paddingBottom: value, paddingLeft: value });
            }}
          />
        </label>
        <div className="field-pair">
          <label>
            Shadow
            <select aria-label="Quick shadow" value={Object.values(shadows).includes(style.boxShadow) ? style.boxShadow : ""} onChange={(event) => setStyle("boxShadow", event.target.value)}>
              {Object.entries(shadows).map(([name, value]) => <option key={name} value={value}>{name}</option>)}
            </select>
          </label>
          <label>
            Animation
            <select aria-label="Quick animation" value={Object.values(animations).includes(style.animation) ? style.animation : ""} onChange={(event) => setStyle("animation", event.target.value)}>
              {Object.entries(animations).map(([name, value]) => <option key={name} value={value}>{name}</option>)}
            </select>
          </label>
        </div>
      </section>
      {canContain(component) && (
        <section className="quick-layout" aria-label="Content layout">
          <div>
            <strong>Arrange content</strong>
            <small>Choose a structure, then adjust spacing and alignment.</small>
          </div>
          <div className="layout-presets" role="group" aria-label="Content layout">
            <button
              className={style.display === "flex" && style.flexDirection === "column" ? "active" : ""}
              aria-label="Content in a column"
              onClick={() => setBaseStyles({ display: "flex", flexDirection: "column", flexWrap: "nowrap" })}
            ><span className="layout-direction vertical" aria-hidden="true"><i /><i /><i /></span><span>Column</span></button>
            <button
              className={style.display === "flex" && style.flexDirection === "row" ? "active" : ""}
              aria-label="Content in a row"
              onClick={() => setBaseStyles({ display: "flex", flexDirection: "row", flexWrap: "nowrap" })}
            ><span className="layout-direction horizontal" aria-hidden="true"><i /><i /><i /></span><span>Row</span></button>
            {[2, 3].map((count) => {
              const columns = `repeat(${count}, minmax(0, 1fr))`;
              return <button
                key={count}
                className={style.display === "grid" && style.gridTemplateColumns === columns ? "active" : ""}
                aria-label={`Quick grid ${count}`}
                onClick={() => setBaseStyles({ display: "grid", gridTemplateColumns: columns })}
              ><span className="layout-columns" aria-hidden="true">{Array.from({ length: count }, (_, index) => <i key={index} />)}</span><span>{count} columns</span></button>;
            })}
          </div>
          <label>
            Element gap <output>{Number.parseInt(style.gap) || 0}px</output>
            <input
              type="range"
              aria-label="Quick gap between elements"
              min="0"
              max="64"
              step="4"
              value={Number.parseInt(style.gap) || 0}
              onChange={(event) => setBaseStyles({ gap: `${event.target.value}px` })}
            />
          </label>
          <div className="layout-control-row">
            <span>Align</span>
            <div role="group" aria-label="Align content">
              {([
                ["flex-start", "Start", "S"],
                ["center", "Center", "C"],
                ["flex-end", "End", "E"],
                ["stretch", "Stretch", "T"],
              ] as const).map(([value, label, symbol]) => <button key={value} className={style.alignItems === value ? "active" : ""} aria-label={`Align content: ${label}`} onClick={() => setBaseStyles({ alignItems: value })}>{symbol}</button>)}
            </div>
          </div>
          <div className="layout-control-row">
            <span>Distribute</span>
            <div role="group" aria-label="Distribute content">
              {([
                ["flex-start", "Start", "S"],
                ["center", "Center", "C"],
                ["space-between", "Space between", "S"],
                ["flex-end", "End", "E"],
              ] as const).map(([value, label, symbol]) => <button key={value} className={style.justifyContent === value ? "active" : ""} aria-label={`Distribute content: ${label}`} onClick={() => setBaseStyles({ justifyContent: value })}>{symbol}</button>)}
            </div>
          </div>
          {style.display === "flex" && (
            <button
              className={`quick-wrap secondary ${style.flexWrap === "wrap" ? "active" : ""}`}
              aria-pressed={style.flexWrap === "wrap"}
              onClick={() => setBaseStyles({ flexWrap: style.flexWrap === "wrap" ? "nowrap" : "wrap" })}
            >Wrap when space runs out</button>
          )}
        </section>
      )}
      <label data-help="Choose the visual container. Page moves the element to the top level.">
        Inside
        <select
          value={component.parentId ?? ""}
          onChange={(event) => onReparent(event.target.value || undefined)}
        >
          <option value="">Page (top level)</option>
          {containers.map((item) => (
            <option key={item.id} value={item.id}>
              {componentPath(components, item.id)
                .map((part) => part.name)
                .join(" / ")}
            </option>
          ))}
        </select>
      </label>

      <details open>
        <summary>Size and responsive</summary>
        <div className="property-section">
          <div className="field-pair">
            {field(
              "Width",
              "width",
              "You can use px, %, rem, vw, or auto.",
            )}
            {field("Height", "height")}
          </div>
          <div className="field-pair">
            {field("Minimum width", "minWidth")}
            {field("Maximum width", "maxWidth")}
          </div>
          <div className="field-pair">
            {field("Minimum height", "minHeight")}
            {field("Maximum height", "maxHeight")}
          </div>
          <div className="field-pair">
            {field("Position X", "marginLeft")}
            {field("Position Y", "marginTop")}
          </div>
          <div className="field-pair">
            {select(
              "Visibility / layout",
              "display",
              ["block", "flex", "grid", "none"],
              `Applies to the ${breakpoint} breakpoint. Choose none to hide it only here.`,
            )}
            {field(
              "Proporzioni",
              "aspectRatio",
              "Esempi: 16 / 9, 1 / 1 oppure auto.",
            )}
          </div>
        </div>
      </details>

      <details open>
        <summary>Alignment and grid</summary>
        <div className="property-section">
          <div className="field-pair">
            {select("Direction", "flexDirection", [
              "row",
              "column",
              "row-reverse",
              "column-reverse",
            ])}
            {select("Wrap", "flexWrap", ["nowrap", "wrap"])}
          </div>
          <div className="field-pair">
            {select("Align", "alignItems", [
              "stretch",
              "flex-start",
              "center",
              "flex-end",
              "baseline",
            ])}
            {select("Distribute", "justifyContent", [
              "flex-start",
              "center",
              "flex-end",
              "space-between",
              "space-around",
              "space-evenly",
            ])}
          </div>
          <div className="field-pair">
            {field("Element gap", "gap")}
            {field(
              "Grid columns",
              "gridTemplateColumns",
              "Simple example: repeat(3, 1fr).",
            )}
          </div>
        </div>
      </details>

      <details>
        <summary>Spacing</summary>
        <div className="property-section">
          <strong>Outer margins</strong>
          <div className="field-grid-4">
            {field("Top", "marginTop")}
            {field("Right", "marginRight")}
            {field("Bottom", "marginBottom")}
            {field("Left", "marginLeft")}
          </div>
          <strong>Inner spacing</strong>
          <div className="field-grid-4">
            {field("Top", "paddingTop")}
            {field("Right", "paddingRight")}
            {field("Bottom", "paddingBottom")}
            {field("Left", "paddingLeft")}
          </div>
        </div>
      </details>

      <details>
        <summary>Text and font</summary>
        <div className="property-section">
          <label>
            Font
            <select
              value={style.fontFamily}
              onChange={(event) => setStyle("fontFamily", event.target.value)}
            >
              <option value="Inter, system-ui, sans-serif">
                Inter / system
              </option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="ui-monospace, monospace">Monospace</option>
            </select>
          </label>
          <div className="field-pair">
            {field("Size", "fontSize")}
            {select("Weight", "fontWeight", [
              "300",
              "400",
              "500",
              "600",
              "700",
              "800",
              "900",
            ])}
          </div>
          <div className="field-pair">
            {field("Line height", "lineHeight")}
            {select("Text alignment", "textAlign", [
              "left",
              "center",
              "right",
              "justify",
            ])}
          </div>
          {color("Text color", "color")}
        </div>
      </details>

      <details>
        <summary>Background, borders, and corners</summary>
        <div className="property-section">
          {color("Background", "background")}
          {field(
            "Image or gradient",
            "backgroundImage",
            "Esempi: url(https://...), linear-gradient(135deg, #6d5dfc, #21c8a4).",
          )}
          <div className="field-pair">
            {select("Background size", "backgroundSize", [
              "cover",
              "contain",
              "auto",
              "100% 100%",
            ])}
            {select("Background position", "backgroundPosition", [
              "center",
              "top",
              "bottom",
              "left",
              "right",
            ])}
          </div>
          <div className="field-pair">
            {field("Border width", "borderWidth")}
            {select("Border style", "borderStyle", [
              "none",
              "solid",
              "dashed",
              "dotted",
              "double",
            ])}
          </div>
          {color("Border color", "borderColor")}
          <strong>Radius per corner</strong>
          <div className="field-grid-4">
            {field("↖", "borderTopLeftRadius")}
            {field("↗", "borderTopRightRadius")}
            {field("↘", "borderBottomRightRadius")}
            {field("↙", "borderBottomLeftRadius")}
          </div>
        </div>
      </details>

      <details>
        <summary>Effects and animations</summary>
        <div className="property-section">
          <label>
            Shadow preset
            <select
              value={
                Object.values(shadows).includes(style.boxShadow)
                  ? style.boxShadow
                  : ""
              }
              onChange={(event) => setStyle("boxShadow", event.target.value)}
            >
              <option value="">Custom</option>
              {Object.entries(shadows).map(([name, value]) => (
                <option key={name} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {field("Custom shadow", "boxShadow")}
          <label>
            Opacity <output>{style.opacity}</output>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={style.opacity}
              onChange={(event) => setStyle("opacity", event.target.value)}
            />
          </label>
          <div className="field-pair">
            {field(
              "Filter",
              "filter",
              "Examples: blur(4px), grayscale(1), brightness(1.2).",
            )}
            {field("Backdrop blur", "backdropFilter")}
          </div>
          {field(
            "Transform",
            "transform",
            "Example: rotate(3deg) scale(1.05).",
          )}
          {field("Transition", "transition")}
          <label>
            Animation preset
            <select
              value={
                Object.values(animations).includes(style.animation)
                  ? style.animation
                  : ""
              }
              onChange={(event) => setStyle("animation", event.target.value)}
            >
              <option value="">Custom</option>
              {Object.entries(animations).map(([name, value]) => (
                <option key={name} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {field("Precise animation", "animation")}
        </div>
      </details>

      <details>
        <summary>Position and overlap</summary>
        <div className="property-section">
          {select("Position", "position", [
            "static",
            "relative",
            "absolute",
            "sticky",
            "fixed",
          ])}
          <div className="field-grid-4">
            {field("Top", "top")}
            {field("Right", "right")}
            {field("Bottom", "bottom")}
            {field("Left", "left")}
          </div>
          <div className="field-pair">
            {field("Layer", "zIndex")}
            {select("Overflow", "overflow", [
              "visible",
              "hidden",
              "auto",
              "scroll",
              "clip",
            ])}
          </div>
          {select("Cursor", "cursor", [
            "auto",
            "default",
            "pointer",
            "text",
            "move",
            "not-allowed",
            "grab",
          ])}
        </div>
      </details>

      <details>
        <summary>Accessibility and help</summary>
        <div className="property-section">
          <label>
            Accessible name
            <input
              value={component.accessibility.label}
              onChange={(event) =>
                onUpdate((item) => ({
                  ...item,
                  accessibility: {
                    ...item.accessibility,
                    label: event.target.value,
                  },
                }))
              }
            />
          </label>
          <label>
            Tooltip
            <input
              value={String(component.props.tooltip ?? "")}
              onChange={(event) =>
                onUpdate((item) => ({
                  ...item,
                  props: { ...item.props, tooltip: event.target.value },
                }))
              }
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={component.props.disabled === true}
              onChange={(event) =>
                onUpdate((item) => ({
                  ...item,
                  props: { ...item.props, disabled: event.target.checked },
                }))
              }
            />
            Disabled
          </label>
        </div>
      </details>

      <div className="button-row">
        <button className="secondary" onClick={onWrap}>
          Group
        </button>
        <button className="secondary" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
