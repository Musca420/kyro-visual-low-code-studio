import { componentTypes, makeComponent, parseProject, type Breakpoint, type EditorComponent, type Flow, type Project } from './model'
import { canContain, descendantIds } from './hierarchy'

export type EditorOperation = { type: string; args?: Record<string, unknown> }

const componentIn = (project: Project, pageId: string, componentId: unknown) => {
  const page = project.pages.find((item) => item.id === pageId)
  const component = page?.components.find((item) => item.id === componentId)
  if (!page || !component) throw new Error('Componente o pagina non trovato')
  return { page, component }
}

export function applyEditorOperation(project: Project, pageId: string, operation: EditorOperation): Project {
  const args = operation.args ?? {}
  if (operation.type === 'apply_editor_transaction') {
    const operations = args.operations
    if (!Array.isArray(operations) || operations.length > 50) throw new Error('La transazione richiede da 1 a 50 operazioni')
    return parseProject(operations.reduce((value, item) => applyEditorOperation(value, pageId, item as EditorOperation), project))
  }
  if (operation.type === 'add_component') {
    const type = String(args.componentType) as EditorComponent['type']
    if (!componentTypes.includes(type)) throw new Error(`Tipo componente non valido: ${type}`)
    const component = makeComponent(type)
    if (typeof args.name === 'string' && args.name.trim()) component.name = args.name.trim()
    if (typeof args.parentId === 'string') {
      const parent = componentIn(project, pageId, args.parentId).component
      if (!canContain(parent)) throw new Error(`${parent.name} non può contenere altri elementi`)
      component.parentId = parent.id
    }
    return parseProject({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, components: [...page.components, component] } : page) })
  }
  if (operation.type === 'create_flow') {
    const flow = args.flow as Flow
    return parseProject({ ...project, flows: [...project.flows, flow] })
  }
  if (operation.type === 'connect_nodes') {
    const flowId = String(args.flowId), source = String(args.source), target = String(args.target), path = args.path === 'error' ? 'error' : 'success'
    return parseProject({ ...project, flows: project.flows.map((flow) => flow.id === flowId ? { ...flow, edges: [...flow.edges, { id: crypto.randomUUID(), source, target, path }] } : flow) })
  }
  if (operation.type === 'create_data_source') {
    const name = String(args.name ?? '').trim(), collection = String(args.collection ?? '').trim(), schema = args.schema
    if (!name || !collection || !schema || typeof schema !== 'object') throw new Error('Nome, collezione e schema sono obbligatori')
    return parseProject({ ...project, dataSources: [...project.dataSources, { id: crypto.randomUUID(), name, provider: 'indexeddb', collection, schema, capabilities: ['get', 'query', 'insert', 'update', 'delete', 'subscribe'], secretStrategy: 'none' }] })
  }
  const { component } = componentIn(project, pageId, args.componentId)
  let nextComponent = component
  if (operation.type === 'set_component_property') {
    const value = args.value
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw new Error('Il valore della proprietà deve essere testo, numero o booleano')
    nextComponent = { ...component, props: { ...component.props, [String(args.property)]: value } }
  }
  else if (operation.type === 'set_component_style' || operation.type === 'set_responsive_style') {
    const breakpoint = (operation.type === 'set_responsive_style' ? args.breakpoint : 'desktop') as Breakpoint
    if (!['desktop', 'tablet', 'mobile'].includes(breakpoint)) throw new Error('Breakpoint non valido')
    nextComponent = { ...component, styles: { ...component.styles, [breakpoint]: { ...component.styles[breakpoint], [String(args.property)]: String(args.value) } } }
  } else if (operation.type === 'move_component') {
    let parentId = component.parentId
    let reparenting = false
    if ('parentId' in args) {
      parentId = typeof args.parentId === 'string' ? args.parentId : undefined
      reparenting = parentId !== component.parentId
      if (parentId) {
        const parent = componentIn(project, pageId, parentId).component
        if (parent.id === component.id || descendantIds(project.pages.find((item) => item.id === pageId)!.components, component.id).has(parent.id)) throw new Error('Spostamento non valido: creerebbe un ciclo')
        if (!canContain(parent)) throw new Error(`${parent.name} non può contenere altri elementi`)
      }
    }
    const resetPlacement = (style: EditorComponent['styles']['desktop']) => ({ ...style, position: 'relative' as const, left: '0px', top: '0px', marginLeft: '0px', marginTop: '0px' })
    nextComponent = { ...component, parentId, styles: reparenting && !('x' in args) && !('y' in args) ? {
      desktop: resetPlacement(component.styles.desktop),
      tablet: resetPlacement({ ...component.styles.desktop, ...component.styles.tablet }),
      mobile: resetPlacement({ ...component.styles.desktop, ...component.styles.mobile }),
    } : { ...component.styles, desktop: { ...component.styles.desktop, marginLeft: String(args.x ?? component.styles.desktop.marginLeft), marginTop: String(args.y ?? component.styles.desktop.marginTop) } } }
  } else if (operation.type === 'resize_component') {
    nextComponent = { ...component, styles: { ...component.styles, desktop: { ...component.styles.desktop, width: String(args.width ?? component.styles.desktop.width), minHeight: String(args.height ?? component.styles.desktop.minHeight) } } }
  } else if (operation.type === 'bind_component_data') {
    nextComponent = { ...component, binding: { sourceId: String(args.sourceId), state: args.state === 'loading' || args.state === 'error' || args.state === 'empty' ? args.state : 'data' } }
  } else if (operation.type === 'remove_component') {
    if (args.confirmed !== true) throw new Error('La rimozione richiede confirmed=true')
    const removed = descendantIds(project.pages.find((item) => item.id === pageId)!.components, component.id); removed.add(component.id)
    return parseProject({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, components: page.components.filter((item) => !removed.has(item.id)) } : page) })
  } else if (operation.type === 'reorder_component') {
    const page = project.pages.find((item) => item.id === pageId)!, siblings = page.components.filter((item) => item.parentId === component.parentId), from = siblings.findIndex((item) => item.id === component.id), to = Number(args.index)
    if (!Number.isInteger(to) || to < 0 || to >= siblings.length) throw new Error('Indice non valido')
    const ordered = [...siblings], [moved] = ordered.splice(from, 1); ordered.splice(to, 0, moved)
    let siblingIndex = 0; const components = page.components.map((item) => item.parentId === component.parentId ? ordered[siblingIndex++] : item)
    return parseProject({ ...project, pages: project.pages.map((item) => item.id === pageId ? { ...item, components } : item) })
  } else if (operation.type === 'wrap_component') {
    const wrapperType = String(args.componentType ?? 'container') as EditorComponent['type']
    if (!componentTypes.includes(wrapperType)) throw new Error(`Tipo contenitore non valido: ${wrapperType}`)
    const wrapper = makeComponent(wrapperType)
    if (!canContain(wrapper)) throw new Error(`${wrapperType} non può contenere altri elementi`)
    wrapper.name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : `Gruppo di ${component.name}`
    wrapper.parentId = component.parentId
    const wrapped = { ...component, parentId: wrapper.id }
    const page = project.pages.find((item) => item.id === pageId)!, index = page.components.findIndex((item) => item.id === component.id), components = [...page.components]
    components.splice(index, 1, wrapper, wrapped)
    return parseProject({ ...project, pages: project.pages.map((item) => item.id === pageId ? { ...item, components } : item) })
  } else throw new Error(`Operazione non supportata: ${operation.type}`)
  return parseProject({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, components: page.components.map((item) => item.id === component.id ? nextComponent : item) } : page) })
}
