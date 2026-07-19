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
  Nessuna: "none",
  Morbida: "0 10px 30px #1720331f",
  Media: "0 16px 42px #1720332b",
  Intensa: "0 24px 70px #1720333d",
};
const animations = {
  Nessuna: "none",
  Dissolvenza: "fe-fade 500ms ease both",
  Salita: "fe-rise 500ms ease both",
  Pulsazione: "fe-pulse 1.4s ease-in-out infinite",
  Galleggia: "fe-float 2.4s ease-in-out infinite",
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
          aria-label={`${label} valore`}
          value={style[key]}
          onChange={(event) => setStyle(key, event.target.value)}
        />
      </span>
    </label>
  );
  return (
    <div className={`properties visual-properties ${advanced ? "advanced" : "simple"}`}>
      <div className="property-mode" aria-label="Livello proprietà">
        <button className={!advanced ? "active" : ""} onClick={() => setAdvanced(false)}>
          Essenziale
        </button>
        <button className={advanced ? "active" : ""} onClick={() => setAdvanced(true)}>
          Avanzata
        </button>
      </div>
      <label>
        Nome elemento
        <input
          value={component.name}
          onChange={(event) =>
            onUpdate((item) => ({ ...item, name: event.target.value }))
          }
        />
      </label>
      <label>
        Testo o etichetta
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
      {["input", "textarea", "select", "checkbox", "radio", "calendar"].includes(component.type) && (
        <label>
          Nome del campo dati
          <input
            value={String(component.props.fieldName ?? "")}
            placeholder="es. email, budget, stato"
            onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, fieldName: event.target.value } }))}
          />
        </label>
      )}
      {component.type === "input" && (
        <><label>Tipo di campo<select value={String(component.props.inputType ?? "text")} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, inputType: event.target.value } }))}><option value="text">Testo</option><option value="email">Email</option><option value="number">Numero</option><option value="password">Password</option><option value="search">Ricerca</option><option value="date">Data</option></select></label><label>Testo di esempio<input value={String(component.props.placeholder ?? "")} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, placeholder: event.target.value } }))} /></label></>
      )}
      {component.type === "button" && <label>Comportamento pulsante<select value={String(component.props.buttonType ?? "button")} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, buttonType: event.target.value } }))}><option value="button">Azione normale</option><option value="submit">Invia il form</option><option value="reset">Azzera il form</option></select></label>}
      <details className="intent-properties">
        <summary>Significato nel programma</summary>
        <div className="property-section">
          <p className="property-help">
            Descrivi il risultato, non il codice. Flow, dati e Codex useranno
            questo significato per mantenere coerente l'elemento.
          </p>
          {(
            [
              ["Ruolo", "role", "Esempio: azione primaria"],
              ["Azione", "action", "Esempio: crea atleta"],
              ["Entità", "entity", "Esempio: Athlete"],
              ["Risultato atteso", "expectedResult", "Esempio: nuovo atleta nella lista"],
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
            <legend>Stati richiesti</legend>
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
            Permessi richiesti
            <input
              value={component.intent.permissions.join(", ")}
              placeholder="Esempio: fotocamera, notifiche"
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
        </div>
      </details>
      {["image", "audio", "video"].includes(component.type) && (
        <label>
          File del progetto
          <select
            value={String(component.props.src ?? "")}
            onChange={(event) =>
              onUpdate((item) => ({
                ...item,
                props: { ...item.props, src: event.target.value },
              }))
            }
          >
            <option value="">Segnaposto</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.url}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label data-help="Scegli quale aspetto stai modificando. Base vale sempre; gli altri si attivano durante l'interazione.">
        Aspetto da modificare
        <select
          value={state}
          onChange={(event) => setState(event.target.value as State)}
        >
          <option value="base">Normale</option>
          <option value="hover">Passaggio cursore</option>
          <option value="focus">Focus da tastiera</option>
          <option value="active">Durante il clic</option>
          <option value="disabled">Disabilitato</option>
        </select>
      </label>
      <section className="quick-style" aria-label="Aspetto rapido">
        <div>
          <strong>Aspetto rapido</strong>
          <small>Fai clic: il risultato appare subito sul canvas.</small>
        </div>
        <div className="palette-swatches" aria-label="Palette pronte">
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
          {color("Colore sfondo", "background")}
          {color("Colore testo", "color")}
        </div>
        <label>
          Gradiente pronto
          <select
            value={visualGradients.some(([, value]) => value === style.backgroundImage) ? style.backgroundImage : "none"}
            onChange={(event) => setStyle("backgroundImage", event.target.value)}
          >
            <option value="none">Nessuno</option>
            {visualGradients.map(([name, value]) => <option key={name} value={value}>{name}</option>)}
          </select>
        </label>
        {assets.length > 0 && (
          <label>
            Immagine di sfondo
            <select
              value={style.backgroundImage.startsWith("url(") ? style.backgroundImage : ""}
              onChange={(event) => setStyle("backgroundImage", event.target.value)}
            >
              <option value="none">Nessuna</option>
              {assets.map((asset) => <option key={asset.id} value={`url(${JSON.stringify(asset.url)})`}>{asset.name}</option>)}
            </select>
          </label>
        )}
        <div className="field-pair">
          <label>
            Font
            <select aria-label="Font rapido" value={style.fontFamily} onChange={(event) => setStyle("fontFamily", event.target.value)}>
              <option value="Inter, system-ui, sans-serif">Moderno</option>
              <option value="Arial, sans-serif">Essenziale</option>
              <option value="Georgia, serif">Editoriale</option>
              <option value="ui-monospace, monospace">Tecnico</option>
            </select>
          </label>
          <label>
            Peso
            <select aria-label="Peso rapido" value={style.fontWeight} onChange={(event) => setStyle("fontWeight", event.target.value)}>
              <option value="400">Normale</option>
              <option value="600">Deciso</option>
              <option value="800">Forte</option>
            </select>
          </label>
        </div>
        <div className="quick-align" aria-label="Allineamento testo">
          {(["left", "center", "right"] as const).map((value) => (
            <button
              aria-label={`Allinea ${value === "left" ? "a sinistra" : value === "center" ? "al centro" : "a destra"}`}
              className={style.textAlign === value ? "active" : ""}
              key={value}
              onClick={() => setStyle("textAlign", value)}
            >
              {value === "left" ? "≡" : value === "center" ? "≣" : "☰"}
            </button>
          ))}
        </div>
        <label>
          Angoli <output>{Number.parseInt(style.borderRadius) || 0}px</output>
          <input
            type="range"
            aria-label="Angoli rapido"
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
          Spazio interno <output>{Number.parseInt(style.padding) || 0}px</output>
          <input
            type="range"
            aria-label="Spazio interno rapido"
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
            Ombra
            <select aria-label="Ombra rapida" value={Object.values(shadows).includes(style.boxShadow) ? style.boxShadow : ""} onChange={(event) => setStyle("boxShadow", event.target.value)}>
              {Object.entries(shadows).map(([name, value]) => <option key={name} value={value}>{name}</option>)}
            </select>
          </label>
          <label>
            Animazione
            <select aria-label="Animazione rapida" value={Object.values(animations).includes(style.animation) ? style.animation : ""} onChange={(event) => setStyle("animation", event.target.value)}>
              {Object.entries(animations).map(([name, value]) => <option key={name} value={value}>{name}</option>)}
            </select>
          </label>
        </div>
      </section>
      {canContain(component) && (
        <section className="quick-layout" aria-label="Disposizione del contenuto">
          <div>
            <strong>Disponi il contenuto</strong>
            <small>Scegli una struttura, poi regola spazio e allineamento.</small>
          </div>
          <div className="layout-presets" role="group" aria-label="Struttura del contenuto">
            <button
              className={style.display === "flex" && style.flexDirection === "column" ? "active" : ""}
              aria-label="Contenuto in colonna"
              onClick={() => setBaseStyles({ display: "flex", flexDirection: "column", flexWrap: "nowrap" })}
            ><span className="layout-direction vertical" aria-hidden="true"><i /><i /><i /></span><span>Colonna</span></button>
            <button
              className={style.display === "flex" && style.flexDirection === "row" ? "active" : ""}
              aria-label="Contenuto in riga"
              onClick={() => setBaseStyles({ display: "flex", flexDirection: "row", flexWrap: "nowrap" })}
            ><span className="layout-direction horizontal" aria-hidden="true"><i /><i /><i /></span><span>Riga</span></button>
            {[2, 3].map((count) => {
              const columns = `repeat(${count}, minmax(0, 1fr))`;
              return <button
                key={count}
                className={style.display === "grid" && style.gridTemplateColumns === columns ? "active" : ""}
                aria-label={`Griglia rapida ${count}`}
                onClick={() => setBaseStyles({ display: "grid", gridTemplateColumns: columns })}
              ><span className="layout-columns" aria-hidden="true">{Array.from({ length: count }, (_, index) => <i key={index} />)}</span><span>{count} colonne</span></button>;
            })}
          </div>
          <label>
            Spazio tra elementi <output>{Number.parseInt(style.gap) || 0}px</output>
            <input
              type="range"
              aria-label="Spazio rapido tra elementi"
              min="0"
              max="64"
              step="4"
              value={Number.parseInt(style.gap) || 0}
              onChange={(event) => setBaseStyles({ gap: `${event.target.value}px` })}
            />
          </label>
          <div className="layout-control-row">
            <span>Allinea</span>
            <div role="group" aria-label="Allinea contenuto">
              {([
                ["flex-start", "Inizio", "I"],
                ["center", "Centro", "C"],
                ["flex-end", "Fine", "F"],
                ["stretch", "Allarga", "A"],
              ] as const).map(([value, label, symbol]) => <button key={value} className={style.alignItems === value ? "active" : ""} aria-label={`Allinea contenuto: ${label}`} onClick={() => setBaseStyles({ alignItems: value })}>{symbol}</button>)}
            </div>
          </div>
          <div className="layout-control-row">
            <span>Distribuisci</span>
            <div role="group" aria-label="Distribuisci contenuto">
              {([
                ["flex-start", "Inizio", "I"],
                ["center", "Centro", "C"],
                ["space-between", "Spazio tra", "S"],
                ["flex-end", "Fine", "F"],
              ] as const).map(([value, label, symbol]) => <button key={value} className={style.justifyContent === value ? "active" : ""} aria-label={`Distribuisci contenuto: ${label}`} onClick={() => setBaseStyles({ justifyContent: value })}>{symbol}</button>)}
            </div>
          </div>
          {style.display === "flex" && (
            <button
              className={`quick-wrap secondary ${style.flexWrap === "wrap" ? "active" : ""}`}
              aria-pressed={style.flexWrap === "wrap"}
              onClick={() => setBaseStyles({ flexWrap: style.flexWrap === "wrap" ? "nowrap" : "wrap" })}
            >Vai a capo quando manca spazio</button>
          )}
        </section>
      )}
      <label data-help="Scegli il contenitore visuale. Pagina riporta l'elemento al livello principale.">
        Dentro
        <select
          value={component.parentId ?? ""}
          onChange={(event) => onReparent(event.target.value || undefined)}
        >
          <option value="">Pagina (livello principale)</option>
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
        <summary>Dimensioni e responsive</summary>
        <div className="property-section">
          <div className="field-pair">
            {field(
              "Larghezza",
              "width",
              "Puoi usare px, %, rem, vw oppure auto.",
            )}
            {field("Altezza", "height")}
          </div>
          <div className="field-pair">
            {field("Min. orizzontale", "minWidth")}
            {field("Max. orizzontale", "maxWidth")}
          </div>
          <div className="field-pair">
            {field("Altezza min.", "minHeight")}
            {field("Altezza max.", "maxHeight")}
          </div>
          <div className="field-pair">
            {field("Posizione X", "marginLeft")}
            {field("Posizione Y", "marginTop")}
          </div>
          <div className="field-pair">
            {select(
              "Visibilità / layout",
              "display",
              ["block", "flex", "grid", "none"],
              `Vale per il breakpoint ${breakpoint}. Scegli none per nascondere solo qui.`,
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
        <summary>Allineamento e griglia</summary>
        <div className="property-section">
          <div className="field-pair">
            {select("Direzione", "flexDirection", [
              "row",
              "column",
              "row-reverse",
              "column-reverse",
            ])}
            {select("A capo", "flexWrap", ["nowrap", "wrap"])}
          </div>
          <div className="field-pair">
            {select("Allinea", "alignItems", [
              "stretch",
              "flex-start",
              "center",
              "flex-end",
              "baseline",
            ])}
            {select("Distribuisci", "justifyContent", [
              "flex-start",
              "center",
              "flex-end",
              "space-between",
              "space-around",
              "space-evenly",
            ])}
          </div>
          <div className="field-pair">
            {field("Spazio tra elementi", "gap")}
            {field(
              "Colonne griglia",
              "gridTemplateColumns",
              "Esempio semplice: repeat(3, 1fr).",
            )}
          </div>
        </div>
      </details>

      <details>
        <summary>Spaziatura</summary>
        <div className="property-section">
          <strong>Margini esterni</strong>
          <div className="field-grid-4">
            {field("Alto", "marginTop")}
            {field("Destra", "marginRight")}
            {field("Basso", "marginBottom")}
            {field("Sinistra", "marginLeft")}
          </div>
          <strong>Spazio interno</strong>
          <div className="field-grid-4">
            {field("Alto", "paddingTop")}
            {field("Destra", "paddingRight")}
            {field("Basso", "paddingBottom")}
            {field("Sinistra", "paddingLeft")}
          </div>
        </div>
      </details>

      <details>
        <summary>Testo e font</summary>
        <div className="property-section">
          <label>
            Font
            <select
              value={style.fontFamily}
              onChange={(event) => setStyle("fontFamily", event.target.value)}
            >
              <option value="Inter, system-ui, sans-serif">
                Inter / sistema
              </option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="ui-monospace, monospace">Monospace</option>
            </select>
          </label>
          <div className="field-pair">
            {field("Dimensione", "fontSize")}
            {select("Peso", "fontWeight", [
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
            {field("Altezza riga", "lineHeight")}
            {select("Allineamento testo", "textAlign", [
              "left",
              "center",
              "right",
              "justify",
            ])}
          </div>
          {color("Colore testo", "color")}
        </div>
      </details>

      <details>
        <summary>Sfondo, bordi e angoli</summary>
        <div className="property-section">
          {color("Sfondo", "background")}
          {field(
            "Immagine o gradiente",
            "backgroundImage",
            "Esempi: url(https://...), linear-gradient(135deg, #6d5dfc, #21c8a4).",
          )}
          <div className="field-pair">
            {select("Adatta sfondo", "backgroundSize", [
              "cover",
              "contain",
              "auto",
              "100% 100%",
            ])}
            {select("Posizione sfondo", "backgroundPosition", [
              "center",
              "top",
              "bottom",
              "left",
              "right",
            ])}
          </div>
          <div className="field-pair">
            {field("Spessore bordo", "borderWidth")}
            {select("Stile bordo", "borderStyle", [
              "none",
              "solid",
              "dashed",
              "dotted",
              "double",
            ])}
          </div>
          {color("Colore bordo", "borderColor")}
          <strong>Raggio per angolo</strong>
          <div className="field-grid-4">
            {field("↖", "borderTopLeftRadius")}
            {field("↗", "borderTopRightRadius")}
            {field("↘", "borderBottomRightRadius")}
            {field("↙", "borderBottomLeftRadius")}
          </div>
        </div>
      </details>

      <details>
        <summary>Effetti e animazioni</summary>
        <div className="property-section">
          <label>
            Ombra pronta
            <select
              value={
                Object.values(shadows).includes(style.boxShadow)
                  ? style.boxShadow
                  : ""
              }
              onChange={(event) => setStyle("boxShadow", event.target.value)}
            >
              <option value="">Personalizzata</option>
              {Object.entries(shadows).map(([name, value]) => (
                <option key={name} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {field("Ombra precisa", "boxShadow")}
          <label>
            Opacita <output>{style.opacity}</output>
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
              "Filtro",
              "filter",
              "Esempi: blur(4px), grayscale(1), brightness(1.2).",
            )}
            {field("Sfocatura sfondo", "backdropFilter")}
          </div>
          {field(
            "Trasformazione",
            "transform",
            "Esempio: rotate(3deg) scale(1.05).",
          )}
          {field("Transizione", "transition")}
          <label>
            Animazione pronta
            <select
              value={
                Object.values(animations).includes(style.animation)
                  ? style.animation
                  : ""
              }
              onChange={(event) => setStyle("animation", event.target.value)}
            >
              <option value="">Personalizzata</option>
              {Object.entries(animations).map(([name, value]) => (
                <option key={name} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {field("Animazione precisa", "animation")}
        </div>
      </details>

      <details>
        <summary>Posizione e sovrapposizione</summary>
        <div className="property-section">
          {select("Posizione", "position", [
            "static",
            "relative",
            "absolute",
            "sticky",
            "fixed",
          ])}
          <div className="field-grid-4">
            {field("Alto", "top")}
            {field("Destra", "right")}
            {field("Basso", "bottom")}
            {field("Sinistra", "left")}
          </div>
          <div className="field-pair">
            {field("Livello", "zIndex")}
            {select("Contenuto in eccesso", "overflow", [
              "visible",
              "hidden",
              "auto",
              "scroll",
              "clip",
            ])}
          </div>
          {select("Cursore", "cursor", [
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
        <summary>Accessibilita e aiuti</summary>
        <div className="property-section">
          <label>
            Nome letto dagli ausili
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
            Disabilitato
          </label>
        </div>
      </details>

      <div className="button-row">
        <button className="secondary" onClick={onWrap}>
          Raggruppa
        </button>
        <button className="secondary" onClick={onDuplicate}>
          Duplica
        </button>
        <button className="danger" onClick={onDelete}>
          Elimina
        </button>
      </div>
    </div>
  );
}
