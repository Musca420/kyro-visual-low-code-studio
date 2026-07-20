import { componentTypes, makeComponent, parseProject, type Breakpoint, type EditorComponent, type Flow, type Project } from './model'
import { canContain, descendantIds } from './hierarchy'
import { nativeExtensionRequests } from './nativeCapabilities'

export type EditorOperation = { type: string; pageId?: string; args?: Record<string, unknown> }

const object = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const componentIn = (project: Project, pageId: string, componentId: unknown) => {
  const page = project.pages.find((item) => item.id === pageId)
  const component = page?.components.find((item) => item.id === componentId)
  if (!page || !component) throw new Error('Component or page not found')
  return { page, component }
}

export function applyEditorOperation(project: Project, pageId: string, operation: EditorOperation): Project {
  const args = operation.args ?? {}
  if (operation.type === 'apply_editor_transaction') {
    const operations = args.operations
    if (!Array.isArray(operations) || operations.length > 50) throw new Error('The transaction requires 1 to 50 operations')
    return parseProject(operations.reduce((value, item) => {
      const next = item as EditorOperation
      return applyEditorOperation(value, next.pageId ?? pageId, next)
    }, project))
  }
  if (operation.type === 'add_page') {
    const name = String(args.name ?? '').trim(), path = String(args.path ?? '').trim(), id = String(args.pageId ?? crypto.randomUUID())
    if (!name || !path.startsWith('/')) throw new Error('Page name and path are required')
    if (project.pages.some((page) => page.id === id || page.path === path)) throw new Error('A page with this ID or path already exists')
    return parseProject({ ...project, pages: [...project.pages, { id, name, path, components: [] }] })
  }
  if (operation.type === 'update_page') {
    const id = String(args.pageId ?? pageId), page = project.pages.find((item) => item.id === id)
    if (!page) throw new Error('Page not found')
    const name = args.name === undefined ? page.name : String(args.name).trim(), path = args.path === undefined ? page.path : String(args.path).trim()
    if (!name || !path.startsWith('/') || project.pages.some((item) => item.id !== id && item.path === path)) throw new Error('Page name or path is not valid')
    return parseProject({ ...project, pages: project.pages.map((item) => item.id === id ? { ...item, name, path } : item) })
  }
  if (operation.type === 'remove_page') {
    const id = String(args.pageId ?? pageId)
    if (args.confirmed !== true) throw new Error('Removal requires confirmed=true')
    if (project.pages.length <= 1) throw new Error('The project must keep at least one page')
    const componentIds = new Set(project.pages.find((item) => item.id === id)?.components.map((item) => item.id) ?? [])
    const flowIds = new Set(project.flows.filter((flow) => flow.nodes.some((node) => componentIds.has(node.config.componentId))).map((flow) => flow.id))
    return parseProject({ ...project, pages: project.pages.filter((item) => item.id !== id), flows: project.flows.filter((flow) => !flowIds.has(flow.id)) })
  }
  if (operation.type === 'set_theme_token') {
    const token = String(args.token ?? '').trim(), value = String(args.value ?? '').trim()
    if (!token || !value) throw new Error('Token and value are required')
    return parseProject({ ...project, theme: { tokens: { ...project.theme.tokens, [token]: value } } })
  }
  if (operation.type === 'set_project_property') {
    if (args.property !== 'name' || !String(args.value ?? '').trim()) throw new Error('Unsupported project property')
    return parseProject({ ...project, name: String(args.value).trim() })
  }
  if (operation.type === 'set_app_config') {
    const patch = object(args.patch), authentication = object(patch.authentication), realtime = object(patch.realtime)
    return parseProject({ ...project, appConfig: { ...project.appConfig, ...patch, authentication: { ...project.appConfig.authentication, ...authentication }, realtime: { ...project.appConfig.realtime, ...realtime } } })
  }
  if (operation.type === 'set_export_config') {
    const patch = object(args.patch), android = object(patch.android)
    return parseProject({ ...project, exportConfig: { ...project.exportConfig, ...patch, ...(patch.android ? { android: { ...project.exportConfig.android, ...android } } : {}) } })
  }
  if (operation.type === 'approve_dependency') {
    if (args.confirmed !== true) throw new Error('Dependency approval requires confirmed=true')
    const packageName = String(args.packageName ?? ''), version = String(args.version ?? '')
    const request = nativeExtensionRequests(project).find((item) => item.packageName === packageName && item.version === version)
    if (!request) throw new Error('This exact dependency is not required by the current visual flow')
    const approval = { packageName, version, reason: request.capabilityLabel, approvedAt: new Date().toISOString() }
    return parseProject({ ...project, extensionApprovals: [...project.extensionApprovals.filter((item) => item.packageName !== packageName), approval] })
  }
  if (operation.type === 'revoke_dependency') {
    if (args.confirmed !== true) throw new Error('Dependency revocation requires confirmed=true')
    const packageName = String(args.packageName ?? '')
    if (!project.extensionApprovals.some((item) => item.packageName === packageName)) throw new Error('Dependency approval not found')
    return parseProject({ ...project, extensionApprovals: project.extensionApprovals.filter((item) => item.packageName !== packageName) })
  }
  if (operation.type === 'add_component') {
    const type = String(args.componentType) as EditorComponent['type']
    if (!componentTypes.includes(type)) throw new Error(`Invalid component type: ${type}`)
    const component = makeComponent(type)
    if (typeof args.componentId === 'string' && args.componentId) component.id = args.componentId
    if (typeof args.name === 'string' && args.name.trim()) component.name = args.name.trim()
    component.props = { ...component.props, ...object(args.props) } as EditorComponent['props']
    const styles = object(args.styles)
    component.styles = {
      desktop: { ...component.styles.desktop, ...object(styles.desktop) },
      tablet: { ...component.styles.tablet, ...object(styles.tablet) },
      mobile: { ...component.styles.mobile, ...object(styles.mobile) },
    } as EditorComponent['styles']
    if (args.accessibility) component.accessibility = { ...component.accessibility, ...object(args.accessibility) }
    if (args.intent) component.intent = { ...component.intent, ...object(args.intent) } as EditorComponent['intent']
    if (typeof args.parentId === 'string') {
      const parent = componentIn(project, pageId, args.parentId).component
      if (!canContain(parent)) throw new Error(`${parent.name} cannot contain other elements`)
      component.parentId = parent.id
    }
    return parseProject({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, components: [...page.components, component] } : page) })
  }
  if (operation.type === 'create_flow') {
    const flow = args.flow as Flow
    return parseProject({ ...project, flows: [...project.flows, flow] })
  }
  if (operation.type === 'add_flow') {
    const name = String(args.name ?? '').trim()
    if (!name) throw new Error('Flow name is required')
    return parseProject({ ...project, flows: [...project.flows, { id: String(args.flowId ?? crypto.randomUUID()), name, nodes: [], edges: [] }] })
  }
  if (operation.type === 'update_flow') {
    const flowId = String(args.flowId), name = String(args.name ?? '').trim()
    if (!name || !project.flows.some((flow) => flow.id === flowId)) throw new Error('Invalid flow')
    return parseProject({ ...project, flows: project.flows.map((flow) => flow.id === flowId ? { ...flow, name } : flow) })
  }
  if (operation.type === 'remove_flow') {
    const flowId = String(args.flowId)
    if (args.confirmed !== true) throw new Error('Removal requires confirmed=true')
    return parseProject({ ...project, flows: project.flows.filter((flow) => flow.id !== flowId), pages: project.pages.map((page) => ({ ...page, components: page.components.map((component) => ({ ...component, events: Object.fromEntries(Object.entries(component.events).filter(([, id]) => id !== flowId)) })) })) })
  }
  if (operation.type === 'add_flow_node') {
    const flowId = String(args.flowId), node = object(args.node)
    return parseProject({ ...project, flows: project.flows.map((flow) => flow.id === flowId ? { ...flow, nodes: [...flow.nodes, node] } : flow) })
  }
  if (operation.type === 'update_flow_node') {
    const flowId = String(args.flowId), nodeId = String(args.nodeId), patch = object(args.patch), config = object(patch.config)
    return parseProject({ ...project, flows: project.flows.map((flow) => flow.id === flowId ? { ...flow, nodes: flow.nodes.map((node) => node.id === nodeId ? { ...node, ...patch, config: { ...node.config, ...config } } : node) } : flow) })
  }
  if (operation.type === 'remove_flow_node') {
    const flowId = String(args.flowId), nodeId = String(args.nodeId)
    return parseProject({ ...project, flows: project.flows.map((flow) => flow.id === flowId ? { ...flow, nodes: flow.nodes.filter((node) => node.id !== nodeId), edges: flow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) } : flow) })
  }
  if (operation.type === 'connect_nodes') {
    const flowId = String(args.flowId), source = String(args.source), target = String(args.target), path = args.path === 'error' ? 'error' : 'success'
    return parseProject({ ...project, flows: project.flows.map((flow) => flow.id === flowId ? { ...flow, edges: [...flow.edges, { id: crypto.randomUUID(), source, target, path }] } : flow) })
  }
  if (operation.type === 'remove_flow_edge') {
    const flowId = String(args.flowId), edgeId = String(args.edgeId)
    return parseProject({ ...project, flows: project.flows.map((flow) => flow.id === flowId ? { ...flow, edges: flow.edges.filter((edge) => edge.id !== edgeId) } : flow) })
  }
  if (operation.type === 'create_data_source') {
    const name = String(args.name ?? '').trim(), collection = String(args.collection ?? '').trim(), schema = args.schema, provider = String(args.provider ?? 'indexeddb')
    if (!name || !collection || !schema || typeof schema !== 'object') throw new Error('Name, collection, and schema are required')
    return parseProject({ ...project, dataSources: [...project.dataSources, { id: String(args.sourceId ?? crypto.randomUUID()), name, provider, collection, schema, capabilities: ['get', 'query', 'insert', 'update', 'delete', 'subscribe'], secretStrategy: provider === 'rest' ? 'environment' : 'none', ...(args.endpoint ? { endpoint: args.endpoint } : {}), ...(args.environmentKey ? { environmentKey: args.environmentKey } : {}) }] })
  }
  if (operation.type === 'update_data_source') {
    const sourceId = String(args.sourceId), patch = object(args.patch)
    return parseProject({ ...project, dataSources: project.dataSources.map((source) => source.id === sourceId ? { ...source, ...patch, id: source.id } : source) })
  }
  if (operation.type === 'remove_data_source') {
    const sourceId = String(args.sourceId)
    if (args.confirmed !== true) throw new Error('Removal requires confirmed=true')
    return parseProject({ ...project, dataSources: project.dataSources.filter((source) => source.id !== sourceId), pages: project.pages.map((page) => ({ ...page, components: page.components.map((component) => component.binding?.sourceId === sourceId ? { ...component, binding: undefined } : component) })) })
  }
  const { component } = componentIn(project, pageId, args.componentId)
  let nextComponent = component
  if (operation.type === 'set_component_property') {
    const value = args.value
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw new Error('The property value must be text, a number, or a boolean')
    nextComponent = args.property === 'name'
      ? { ...component, name: String(value).trim() || component.name }
      : { ...component, props: { ...component.props, [String(args.property)]: value } }
  }
  else if (operation.type === 'set_component_style' || operation.type === 'set_responsive_style') {
    const breakpoint = (operation.type === 'set_responsive_style' ? args.breakpoint : 'desktop') as Breakpoint
    if (!['desktop', 'tablet', 'mobile'].includes(breakpoint)) throw new Error('Invalid breakpoint')
    nextComponent = { ...component, styles: { ...component.styles, [breakpoint]: { ...component.styles[breakpoint], [String(args.property)]: String(args.value) } } }
  } else if (operation.type === 'set_component_state_style') {
    const state = String(args.state) as keyof EditorComponent['states']
    if (!['hover', 'focus', 'active', 'disabled'].includes(state)) throw new Error('Invalid component state')
    nextComponent = { ...component, states: { ...component.states, [state]: { ...component.states[state], [String(args.property)]: String(args.value) } } }
  } else if (operation.type === 'set_component_accessibility') {
    const label = String(args.label ?? '').trim()
    if (!label) throw new Error('An accessible label is required')
    nextComponent = { ...component, accessibility: { label, ...(args.role ? { role: String(args.role) } : {}) } }
  } else if (operation.type === 'set_component_intent') {
    nextComponent = { ...component, intent: { ...component.intent, ...object(args.intent) } as EditorComponent['intent'] }
  } else if (operation.type === 'set_component_event') {
    const event = String(args.event ?? '').trim(), flowId = String(args.flowId ?? '').trim()
    if (!event || !project.flows.some((flow) => flow.id === flowId)) throw new Error('Invalid event or flow')
    nextComponent = { ...component, events: { ...component.events, [event]: flowId } }
  } else if (operation.type === 'remove_component_event') {
    const event = String(args.event ?? '').trim()
    if (!event) throw new Error('An event is required')
    nextComponent = { ...component, events: Object.fromEntries(Object.entries(component.events).filter(([name]) => name !== event)) }
  } else if (operation.type === 'move_component') {
    let parentId = component.parentId
    let reparenting = false
    if ('parentId' in args) {
      parentId = typeof args.parentId === 'string' ? args.parentId : undefined
      reparenting = parentId !== component.parentId
      if (parentId) {
        const parent = componentIn(project, pageId, parentId).component
        if (parent.id === component.id || descendantIds(project.pages.find((item) => item.id === pageId)!.components, component.id).has(parent.id)) throw new Error('Invalid move: it would create a cycle')
        if (!canContain(parent)) throw new Error(`${parent.name} cannot contain other elements`)
      }
    }
    const resetPlacement = (style: EditorComponent['styles']['desktop']) => ({ ...style, position: 'relative' as const, left: '0px', top: '0px', marginLeft: '0px', marginTop: '0px' })
    nextComponent = { ...component, parentId, styles: reparenting && !('x' in args) && !('y' in args) ? {
      desktop: resetPlacement(component.styles.desktop),
      tablet: resetPlacement({ ...component.styles.desktop, ...component.styles.tablet }),
      mobile: resetPlacement({ ...component.styles.desktop, ...component.styles.mobile }),
    } : { ...component.styles, desktop: { ...component.styles.desktop, marginLeft: String(args.x ?? component.styles.desktop.marginLeft), marginTop: String(args.y ?? component.styles.desktop.marginTop) } } }
    if ('index' in args) {
      const page = project.pages.find((item) => item.id === pageId)!
      const without = page.components.filter((item) => item.id !== component.id)
      const siblings = without.filter((item) => item.parentId === parentId)
      const index = Number(args.index)
      if (!Number.isInteger(index) || index < 0 || index > siblings.length) throw new Error('Invalid index')
      const insertion = index < siblings.length ? without.findIndex((item) => item.id === siblings[index].id) : siblings.length ? without.findIndex((item) => item.id === siblings.at(-1)!.id) + 1 : without.length
      without.splice(insertion, 0, nextComponent)
      return parseProject({ ...project, pages: project.pages.map((item) => item.id === pageId ? { ...item, components: without } : item) })
    }
  } else if (operation.type === 'resize_component') {
    nextComponent = { ...component, styles: { ...component.styles, desktop: { ...component.styles.desktop, width: String(args.width ?? component.styles.desktop.width), minHeight: String(args.height ?? component.styles.desktop.minHeight) } } }
  } else if (operation.type === 'bind_component_data') {
    nextComponent = { ...component, binding: { sourceId: String(args.sourceId), state: args.state === 'loading' || args.state === 'error' || args.state === 'empty' ? args.state : 'data' } }
  } else if (operation.type === 'remove_component') {
    if (args.confirmed !== true) throw new Error('Removal requires confirmed=true')
    const removed = descendantIds(project.pages.find((item) => item.id === pageId)!.components, component.id); removed.add(component.id)
    return parseProject({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, components: page.components.filter((item) => !removed.has(item.id)) } : page) })
  } else if (operation.type === 'reorder_component') {
    const page = project.pages.find((item) => item.id === pageId)!, siblings = page.components.filter((item) => item.parentId === component.parentId), from = siblings.findIndex((item) => item.id === component.id), to = Number(args.index)
    if (!Number.isInteger(to) || to < 0 || to >= siblings.length) throw new Error('Invalid index')
    const ordered = [...siblings], [moved] = ordered.splice(from, 1); ordered.splice(to, 0, moved)
    let siblingIndex = 0; const components = page.components.map((item) => item.parentId === component.parentId ? ordered[siblingIndex++] : item)
    return parseProject({ ...project, pages: project.pages.map((item) => item.id === pageId ? { ...item, components } : item) })
  } else if (operation.type === 'wrap_component') {
    const wrapperType = String(args.componentType ?? 'container') as EditorComponent['type']
    if (!componentTypes.includes(wrapperType)) throw new Error(`Invalid container type: ${wrapperType}`)
    const wrapper = makeComponent(wrapperType)
    if (!canContain(wrapper)) throw new Error(`${wrapperType} cannot contain other elements`)
    wrapper.name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : `${component.name} group`
    wrapper.parentId = component.parentId
    const wrapped = { ...component, parentId: wrapper.id }
    const page = project.pages.find((item) => item.id === pageId)!, index = page.components.findIndex((item) => item.id === component.id), components = [...page.components]
    components.splice(index, 1, wrapper, wrapped)
    return parseProject({ ...project, pages: project.pages.map((item) => item.id === pageId ? { ...item, components } : item) })
  } else throw new Error(`Unsupported operation: ${operation.type}`)
  return parseProject({ ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, components: page.components.map((item) => item.id === component.id ? nextComponent : item) } : page) })
}
