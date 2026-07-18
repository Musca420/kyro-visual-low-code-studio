import { useState } from 'react'
import { canContain, componentPath, descendantIds } from './hierarchy'
import type { Breakpoint, EditorComponent } from './model'

type Props = { component: EditorComponent; components: EditorComponent[]; breakpoint: Breakpoint; onUpdate: (update: (component: EditorComponent) => EditorComponent) => void; onReparent: (parentId?: string) => void; onWrap: () => void; onDuplicate: () => void; onDelete: () => void }
type Style = EditorComponent['styles']['desktop']
type State = 'base' | keyof EditorComponent['states']

const shadows = { Nessuna: 'none', Morbida: '0 10px 30px #1720331f', Media: '0 16px 42px #1720332b', Intensa: '0 24px 70px #1720333d' }
const animations = { Nessuna: 'none', Dissolvenza: 'fe-fade 500ms ease both', Salita: 'fe-rise 500ms ease both', Pulsazione: 'fe-pulse 1.4s ease-in-out infinite', Galleggia: 'fe-float 2.4s ease-in-out infinite' }

export function VisualProperties({ component, components, breakpoint, onUpdate, onReparent, onWrap, onDuplicate, onDelete }: Props) {
  const [state, setState] = useState<State>('base')
  const base = { ...component.styles.desktop, ...(breakpoint === 'desktop' ? {} : component.styles[breakpoint]) }
  const style = state === 'base' ? base : { ...base, ...component.states[state] }
  const setStyle = (key: keyof Style, value: string) => onUpdate((item) => state === 'base' ? { ...item, styles: { ...item.styles, [breakpoint]: { ...item.styles[breakpoint], [key]: value } } } : { ...item, states: { ...item.states, [state]: { ...item.states[state], [key]: value } } })
  const excluded = descendantIds(components, component.id); excluded.add(component.id)
  const containers = components.filter((item) => canContain(item) && !excluded.has(item.id))
  const field = (label: string, key: keyof Style, help?: string) => <label data-help={help}>{label}<input value={style[key]} onChange={(event) => setStyle(key, event.target.value)} /></label>
  const select = (label: string, key: keyof Style, options: readonly string[], help?: string) => <label data-help={help}>{label}<select value={style[key]} onChange={(event) => setStyle(key, event.target.value)}>{options.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
  const color = (label: string, key: keyof Style) => <label>{label}<span className="color-field"><input type="color" value={/^#[0-9a-f]{6}$/i.test(style[key]) ? style[key] : '#ffffff'} onChange={(event) => setStyle(key, event.target.value)} /><input aria-label={`${label} valore`} value={style[key]} onChange={(event) => setStyle(key, event.target.value)} /></span></label>
  return <div className="properties visual-properties">
    <label>Nome elemento<input value={component.name} onChange={(event) => onUpdate((item) => ({ ...item, name: event.target.value }))} /></label>
    <label>Testo o etichetta<input value={String(component.props.label ?? '')} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, label: event.target.value }, accessibility: { ...item.accessibility, label: event.target.value } }))} /></label>
    <label data-help="Scegli quale aspetto stai modificando. Base vale sempre; gli altri si attivano durante l'interazione.">Aspetto da modificare<select value={state} onChange={(event) => setState(event.target.value as State)}><option value="base">Normale</option><option value="hover">Passaggio cursore</option><option value="focus">Focus da tastiera</option><option value="active">Durante il clic</option><option value="disabled">Disabilitato</option></select></label>
    <label data-help="Scegli il contenitore visuale. Pagina riporta l'elemento al livello principale.">Dentro<select value={component.parentId ?? ''} onChange={(event) => onReparent(event.target.value || undefined)}><option value="">Pagina (livello principale)</option>{containers.map((item) => <option key={item.id} value={item.id}>{componentPath(components, item.id).map((part) => part.name).join(' / ')}</option>)}</select></label>

    <details open><summary>Dimensioni e responsive</summary><div className="property-section">
      <div className="field-pair">{field('Larghezza', 'width', 'Puoi usare px, %, rem, vw oppure auto.')}{field('Altezza', 'height')}</div>
      <div className="field-pair">{field('Min. orizzontale', 'minWidth')}{field('Max. orizzontale', 'maxWidth')}</div>
      <div className="field-pair">{field('Altezza min.', 'minHeight')}{field('Altezza max.', 'maxHeight')}</div>
      <div className="field-pair">{field('Posizione X', 'marginLeft')}{field('Posizione Y', 'marginTop')}</div>
      <div className="field-pair">{select('VisibilitÃ  / layout', 'display', ['block', 'flex', 'grid', 'none'], `Vale per il breakpoint ${breakpoint}. Scegli none per nascondere solo qui.`)}{field('Proporzioni', 'aspectRatio', 'Esempi: 16 / 9, 1 / 1 oppure auto.')}</div>
    </div></details>

    <details open><summary>Allineamento e griglia</summary><div className="property-section">
      <div className="field-pair">{select('Direzione', 'flexDirection', ['row', 'column', 'row-reverse', 'column-reverse'])}{select('A capo', 'flexWrap', ['nowrap', 'wrap'])}</div>
      <div className="field-pair">{select('Allinea', 'alignItems', ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'])}{select('Distribuisci', 'justifyContent', ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'])}</div>
      <div className="field-pair">{field('Spazio tra elementi', 'gap')}{field('Colonne griglia', 'gridTemplateColumns', 'Esempio semplice: repeat(3, 1fr).')}</div>
    </div></details>

    <details><summary>Spaziatura</summary><div className="property-section"><strong>Margini esterni</strong><div className="field-grid-4">{field('Alto', 'marginTop')}{field('Destra', 'marginRight')}{field('Basso', 'marginBottom')}{field('Sinistra', 'marginLeft')}</div><strong>Spazio interno</strong><div className="field-grid-4">{field('Alto', 'paddingTop')}{field('Destra', 'paddingRight')}{field('Basso', 'paddingBottom')}{field('Sinistra', 'paddingLeft')}</div></div></details>

    <details><summary>Testo e font</summary><div className="property-section">
      <label>Font<select value={style.fontFamily} onChange={(event) => setStyle('fontFamily', event.target.value)}><option value="Inter, system-ui, sans-serif">Inter / sistema</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="ui-monospace, monospace">Monospace</option></select></label>
      <div className="field-pair">{field('Dimensione', 'fontSize')}{select('Peso', 'fontWeight', ['300', '400', '500', '600', '700', '800', '900'])}</div><div className="field-pair">{field('Altezza riga', 'lineHeight')}{select('Allineamento testo', 'textAlign', ['left', 'center', 'right', 'justify'])}</div>{color('Colore testo', 'color')}
    </div></details>

    <details><summary>Sfondo, bordi e angoli</summary><div className="property-section">
      {color('Sfondo', 'background')}{field('Immagine o gradiente', 'backgroundImage', 'Esempi: url(https://...), linear-gradient(135deg, #6d5dfc, #21c8a4).')}<div className="field-pair">{select('Adatta sfondo', 'backgroundSize', ['cover', 'contain', 'auto', '100% 100%'])}{select('Posizione sfondo', 'backgroundPosition', ['center', 'top', 'bottom', 'left', 'right'])}</div>
      <div className="field-pair">{field('Spessore bordo', 'borderWidth')}{select('Stile bordo', 'borderStyle', ['none', 'solid', 'dashed', 'dotted', 'double'])}</div>{color('Colore bordo', 'borderColor')}
      <strong>Raggio per angolo</strong><div className="field-grid-4">{field('↖', 'borderTopLeftRadius')}{field('↗', 'borderTopRightRadius')}{field('↘', 'borderBottomRightRadius')}{field('↙', 'borderBottomLeftRadius')}</div>
    </div></details>

    <details><summary>Effetti e animazioni</summary><div className="property-section">
      <label>Ombra pronta<select value={Object.values(shadows).includes(style.boxShadow) ? style.boxShadow : ''} onChange={(event) => setStyle('boxShadow', event.target.value)}><option value="">Personalizzata</option>{Object.entries(shadows).map(([name, value]) => <option key={name} value={value}>{name}</option>)}</select></label>{field('Ombra precisa', 'boxShadow')}
      <label>Opacita <output>{style.opacity}</output><input type="range" min="0" max="1" step="0.05" value={style.opacity} onChange={(event) => setStyle('opacity', event.target.value)} /></label>
      <div className="field-pair">{field('Filtro', 'filter', 'Esempi: blur(4px), grayscale(1), brightness(1.2).')}{field('Sfocatura sfondo', 'backdropFilter')}</div>{field('Trasformazione', 'transform', 'Esempio: rotate(3deg) scale(1.05).')}{field('Transizione', 'transition')}
      <label>Animazione pronta<select value={Object.values(animations).includes(style.animation) ? style.animation : ''} onChange={(event) => setStyle('animation', event.target.value)}><option value="">Personalizzata</option>{Object.entries(animations).map(([name, value]) => <option key={name} value={value}>{name}</option>)}</select></label>{field('Animazione precisa', 'animation')}
    </div></details>

    <details><summary>Posizione e sovrapposizione</summary><div className="property-section">{select('Posizione', 'position', ['static', 'relative', 'absolute', 'sticky', 'fixed'])}<div className="field-grid-4">{field('Alto', 'top')}{field('Destra', 'right')}{field('Basso', 'bottom')}{field('Sinistra', 'left')}</div><div className="field-pair">{field('Livello', 'zIndex')}{select('Contenuto in eccesso', 'overflow', ['visible', 'hidden', 'auto', 'scroll', 'clip'])}</div>{select('Cursore', 'cursor', ['auto', 'default', 'pointer', 'text', 'move', 'not-allowed', 'grab'])}</div></details>

    <details><summary>Accessibilita e aiuti</summary><div className="property-section"><label>Nome letto dagli ausili<input value={component.accessibility.label} onChange={(event) => onUpdate((item) => ({ ...item, accessibility: { ...item.accessibility, label: event.target.value } }))} /></label><label>Tooltip<input value={String(component.props.tooltip ?? '')} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, tooltip: event.target.value } }))} /></label><label className="check-row"><input type="checkbox" checked={component.props.disabled === true} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, disabled: event.target.checked } }))} />Disabilitato</label></div></details>

    <div className="button-row"><button className="secondary" onClick={onWrap}>Raggruppa</button><button className="secondary" onClick={onDuplicate}>Duplica</button><button className="danger" onClick={onDelete}>Elimina</button></div>
  </div>
}
