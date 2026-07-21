import { componentTypes, makeComponent, parseProject, type Breakpoint, type EditorComponent, type Flow, type Project } from './model'
import { canContain, descendantIds } from './hierarchy'
import { nativeAction, nativeCapability, nativeExtensionRequests } from './nativeCapabilities'
import { testCodeModule } from './codeModules'

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
  if (operation.type === 'restore_project_revision') {
    if (args.confirmed !== true) throw new Error('Restoring a revision requires confirmed=true')
    const restored = parseProject(args.project)
    if (restored.id !== project.id) throw new Error('The revision belongs to another project')
    return restored
  }
  if (operation.type === 'set_theme_tokens') {
    const tokens = object(args.tokens)
    return parseProject({ ...project, theme: { tokens: { ...project.theme.tokens, ...tokens } } })
  }
  if (operation.type === 'set_project_assets') {
    if (!Array.isArray(args.assets)) throw new Error('Assets must be a list')
    return parseProject({ ...project, assets: args.assets })
  }
  if (operation.type === 'set_reusable_components') {
    if (!Array.isArray(args.components)) throw new Error('Reusable components must be a list')
    return parseProject({ ...project, reusableComponents: args.components })
  }
  if (operation.type === 'set_code_modules') {
    if (!Array.isArray(args.modules)) throw new Error('Code modules must be a list')
    return parseProject({ ...project, codeModules: args.modules })
  }
  if (operation.type === 'set_project_plugins') {
    if (!Array.isArray(args.plugins)) throw new Error('Plugins must be a list')
    return parseProject({ ...project, plugins: args.plugins })
  }
  if (operation.type === 'set_project_flows') {
    if (!Array.isArray(args.flows)) throw new Error('Flows must be a list')
    return parseProject({ ...project, flows: args.flows })
  }
  if (operation.type === 'set_flow_runs') {
    if (!Array.isArray(args.runs)) throw new Error('Flow runs must be a list')
    return parseProject({ ...project, flowRuns: args.runs })
  }
  if (operation.type === 'set_project_settings') {
    const appConfig = args.appConfig === undefined ? project.appConfig : object(args.appConfig)
    const exportConfig = args.exportConfig === undefined ? project.exportConfig : object(args.exportConfig)
    const extensionApprovals = args.extensionApprovals === undefined ? project.extensionApprovals : args.extensionApprovals
    if (!Array.isArray(extensionApprovals)) throw new Error('Extension approvals must be a list')
    return parseProject({ ...project, appConfig, exportConfig, extensionApprovals })
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
  if (operation.type === 'set_page_components') {
    if (!Array.isArray(args.components)) throw new Error('Page components must be a list')
    if (!project.pages.some((item) => item.id === pageId)) throw new Error('Page not found')
    return parseProject({ ...project, pages: project.pages.map((item) => item.id === pageId ? { ...item, components: args.components } : item) })
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
    const rawPatch = object(args.patch), navigation = object(rawPatch.navigation), nestedBottomNavigation = object(navigation.mobileBottomNavigation)
    const patch = Object.fromEntries(Object.entries(rawPatch).filter(([key]) => key !== 'navigation'))
    if (Object.keys(nestedBottomNavigation).length) {
      const { safeArea, ...mobileBottomNavigation } = nestedBottomNavigation
      patch.mobileBottomNavigation = mobileBottomNavigation
      if (typeof safeArea === 'boolean') patch.safeArea = safeArea
    }
    const authentication = object(patch.authentication), realtime = object(patch.realtime)
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
    const approval = { packageName, version, reason: request.capabilityLabel, license: request.license, risk: request.risk, rollback: request.rollback, platforms: request.platforms, approvedAt: new Date().toISOString() }
    return parseProject({ ...project, extensionApprovals: [...project.extensionApprovals.filter((item) => item.packageName !== packageName), approval] })
  }
  if (operation.type === 'revoke_dependency') {
    if (args.confirmed !== true) throw new Error('Dependency revocation requires confirmed=true')
    const packageName = String(args.packageName ?? '')
    if (!project.extensionApprovals.some((item) => item.packageName === packageName)) throw new Error('Dependency approval not found')
    return parseProject({ ...project, extensionApprovals: project.extensionApprovals.filter((item) => item.packageName !== packageName) })
  }
  if (operation.type === 'create_code_module') {
    const module = object(args.module) as Project['codeModules'][number]
    if (project.codeModules.some((item) => item.id === module.id)) throw new Error('A module with this ID already exists')
    const candidate = parseProject({ ...project, codeModules: [...project.codeModules, module] })
    const created = candidate.codeModules.at(-1)!
    if (!created.tests.length || testCodeModule(created).some((test) => !test.passed)) throw new Error('A reusable module requires at least one passing test')
    return candidate
  }
  if (operation.type === 'update_code_module') {
    const moduleId = String(args.moduleId), current = project.codeModules.find((item) => item.id === moduleId)
    if (!current) throw new Error('Module not found')
    const patch = object(args.patch)
    const candidate = parseProject({ ...project, codeModules: project.codeModules.map((item) => item.id === moduleId ? { ...item, ...patch, id: item.id } : item) })
    const updated = candidate.codeModules.find((item) => item.id === moduleId)!
    if (!updated.tests.length || testCodeModule(updated).some((test) => !test.passed)) throw new Error('A reusable module requires passing tests')
    return candidate
  }
  if (operation.type === 'remove_code_module') {
    const moduleId = String(args.moduleId)
    if (args.confirmed !== true) throw new Error('Removal requires confirmed=true')
    if (project.flows.some((flow) => flow.nodes.some((node) => node.config.moduleId === moduleId))) throw new Error('Disconnect the module from its flows before removing it')
    return parseProject({ ...project, codeModules: project.codeModules.filter((item) => item.id !== moduleId) })
  }
  if (operation.type === 'compose_screen') {
    const page = project.pages.find((item) => item.id === pageId)
    if (!page) throw new Error('Page not found')
    const sections = Array.isArray(args.sections) ? args.sections.slice(0, 20).map(object) : []
    const navigation = Array.isArray(args.navigation) ? args.navigation.slice(0, 8).map(object) : []
    if (!sections.length) throw new Error('A composed screen requires at least one section')
    if (args.replaceExisting === true && args.confirmed !== true) throw new Error('Replacing a screen requires confirmed=true')
    const theme = object(args.theme), primary = String(theme.primary ?? project.theme.tokens.primary ?? '#22d3ee'), accent = String(theme.accent ?? project.theme.tokens.accent ?? '#fb7185')
    const background = String(theme.background ?? project.theme.tokens.pageBackground ?? '#0f1115'), surface = String(theme.surface ?? '#171a21'), color = String(theme.text ?? '#f8fafc')
    let next = args.replaceExisting === true
      ? parseProject({ ...project, pages: project.pages.map((item) => item.id === pageId ? { ...item, components: [] } : item) })
      : project
    next = parseProject({ ...next, theme: { tokens: { ...next.theme.tokens, primary, accent, pageBackground: background, text: color, surface } } })
    const rootId = crypto.randomUUID()
    next = applyEditorOperation(next, pageId, { type: 'add_component', args: {
      componentId: rootId, componentType: 'section', name: String(args.name ?? page.name), props: { label: String(args.name ?? page.name) },
      styles: { desktop: { width: '100%', maxWidth: args.layout === 'web-landing' ? '1200px' : '960px', marginLeft: 'auto', marginRight: 'auto', padding: '32px', background, color, display: 'flex', flexDirection: 'column', gap: '24px' }, tablet: { padding: '24px', gap: '20px' }, mobile: { padding: '16px', paddingBottom: navigation.length ? '104px' : '24px', gap: '18px' } },
      accessibility: { label: String(args.name ?? page.name), role: 'main' }, intent: { role: String(args.layout ?? 'screen'), expectedResult: String(args.expectedResult ?? `Use ${args.name ?? page.name}`), requiredStates: args.states === true ? ['loading', 'success', 'error'] : [], permissions: [] },
    } })
    const visualStyle = (type: string) => ({
      desktop: {
        width: '100%', ...(type === 'button' || type === 'input' || type === 'select' ? { minHeight: '48px' } : {}),
        ...(['card', 'list', 'table', 'form', 'map', 'calendar', 'chart', 'gallery'].includes(type) ? { padding: '18px' } : {}),
        borderRadius: ['title', 'text', 'link', 'grid', 'section'].includes(type) ? '0px' : '16px',
        background: type === 'button' ? primary : ['card', 'list', 'table', 'form', 'map', 'calendar', 'chart', 'gallery', 'input', 'select'].includes(type) ? surface : 'transparent',
        color: type === 'button' ? background : color,
        ...(type === 'grid' ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' } : {}),
      },
      mobile: type === 'grid' ? { gridTemplateColumns: '1fr' } : {},
    })
    for (const section of sections) {
      const sectionId = crypto.randomUUID(), type = componentTypes.includes(String(section.type) as EditorComponent['type']) ? String(section.type) : 'section'
      next = applyEditorOperation(next, pageId, { type: 'add_component', args: { componentId: sectionId, componentType: 'section', parentId: rootId, name: String(section.name ?? section.label ?? 'Section'), props: { label: String(section.label ?? section.name ?? 'Section'), ...(section.description ? { description: String(section.description) } : {}) }, styles: { desktop: { width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', background: 'transparent', color, padding: '0px', borderRadius: '0px', minHeight: '0px' } }, accessibility: { label: String(section.label ?? section.name ?? 'Section'), role: 'region' }, intent: { role: String(section.role ?? 'content-section'), expectedResult: String(section.expectedResult ?? section.label ?? section.name ?? 'Present content'), requiredStates: [], permissions: [] } } })
      if (type !== 'section') next = applyEditorOperation(next, pageId, { type: 'add_component', args: { componentType: type, parentId: sectionId, name: String(section.name ?? section.label ?? type), props: { label: String(section.label ?? section.name ?? type), ...(section.description ? { description: String(section.description) } : {}) }, styles: visualStyle(type), accessibility: { label: String(section.label ?? section.name ?? type) }, intent: { role: String(section.role ?? type), expectedResult: String(section.expectedResult ?? section.label ?? section.name ?? type), requiredStates: [], permissions: [] } } })
      const items = Array.isArray(section.items) ? section.items.slice(0, 12).map(object) : []
      for (const item of items) {
        const itemType = componentTypes.includes(String(item.type) as EditorComponent['type']) ? String(item.type) : 'card'
        next = applyEditorOperation(next, pageId, { type: 'add_component', args: { componentType: itemType, parentId: sectionId, name: String(item.name ?? item.label ?? itemType), props: { label: String(item.label ?? item.name ?? itemType), ...(item.description ? { description: String(item.description) } : {}), ...(item.path ? { path: String(item.path) } : {}) }, styles: visualStyle(itemType), accessibility: { label: String(item.label ?? item.name ?? itemType) }, intent: { role: String(item.role ?? itemType), expectedResult: String(item.expectedResult ?? item.label ?? item.name ?? itemType), requiredStates: [], permissions: [] } } })
      }
    }
    if (args.states === true) for (const [type, label] of [['skeleton', 'Loading'], ['empty', 'No content yet'], ['alert', 'Something went wrong']] as const)
      next = applyEditorOperation(next, pageId, { type: 'add_component', args: { componentType: type, parentId: rootId, name: `${label} state`, props: { label }, styles: { desktop: { width: '100%', padding: '18px', borderRadius: '16px', background: surface, display: 'none' } }, accessibility: { label, role: type === 'alert' ? 'alert' : 'status' }, intent: { role: `${type}-state`, expectedResult: label, requiredStates: [], permissions: [] } } })
    if (navigation.length) {
      const navId = crypto.randomUUID()
      next = applyEditorOperation(next, pageId, { type: 'add_component', args: { componentId: navId, componentType: 'navbar', parentId: rootId, name: 'Primary navigation', props: { label: navigation.map((item) => item.label).join(' · ') }, styles: { desktop: { width: '100%', minHeight: '64px', display: 'grid', gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))`, gap: '4px', padding: '8px', borderRadius: '20px', background: surface }, mobile: { position: 'fixed', left: '12px', right: '12px', bottom: '12px', width: 'auto', zIndex: '20' } }, accessibility: { label: 'Primary navigation', role: 'navigation' }, intent: { role: 'primary-navigation', expectedResult: 'Navigate between primary pages', requiredStates: [], permissions: [] } } })
      for (const item of navigation) next = applyEditorOperation(next, pageId, { type: 'add_component', args: { componentType: 'link', parentId: navId, name: String(item.label ?? 'Page'), props: { label: String(item.label ?? 'Page'), path: String(item.path ?? '/') }, styles: { desktop: { minWidth: '48px', minHeight: '48px', color, textAlign: 'center', background: 'transparent', padding: '12px 6px', borderRadius: '12px' } }, accessibility: { label: String(item.label ?? 'Page'), role: 'link' }, intent: { role: 'navigation-item', action: 'navigate', expectedResult: `Open ${String(item.label ?? 'page')}`, requiredStates: [], permissions: [] } } })
      if (String(args.layout ?? '').startsWith('mobile')) next = parseProject({ ...next, appConfig: { ...next.appConfig, safeArea: true, mobileBottomNavigation: { enabled: true, items: navigation.map((item) => ({ label: String(item.label ?? 'Page'), path: String(item.path ?? '/') })) } } })
    }
    return next
  }
  if (operation.type === 'add_component') {
    const type = String(args.componentType) as EditorComponent['type']
    if (!componentTypes.includes(type)) throw new Error(`Invalid component type: ${type}`)
    const component = makeComponent(type)
    if (typeof args.componentId === 'string' && args.componentId) component.id = args.componentId
    if (typeof args.name === 'string' && args.name.trim()) component.name = args.name.trim()
    component.props = { ...component.props, ...object(args.props) } as EditorComponent['props']
    const styles = object(args.styles)
    const desktopPatch = object(styles.desktop)
    const tabletPatch = { ...desktopPatch, ...object(styles.tablet) }
    const mobilePatch = { ...desktopPatch, ...object(styles.mobile) }
    component.styles = {
      desktop: { ...component.styles.desktop, ...desktopPatch },
      tablet: { ...component.styles.tablet, ...tabletPatch },
      mobile: { ...component.styles.mobile, ...mobilePatch },
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
  if (operation.type === 'compose_record_action') {
    const { component } = componentIn(project, pageId, args.componentId)
    const action = args.action === 'delete' ? 'delete' : args.action === 'update' ? 'update' : undefined
    if (!action || !['list', 'table'].includes(component.type)) throw new Error('Record actions require update or delete on a list or table')
    const sourceId = String(args.sourceId ?? component.binding?.sourceId ?? '')
    if (!project.dataSources.some((source) => source.id === sourceId)) throw new Error('The record action requires an existing data source')
    const event = action === 'delete' ? 'recordDelete' : 'recordUpdate'
    if (component.events[event]) return project
    const entity = String(args.entity ?? project.dataSources.find((source) => source.id === sourceId)?.name ?? 'record').trim()
    const name = `${action === 'delete' ? 'Delete' : 'Update'} ${entity}`
    if (project.flows.some((flow) => flow.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('A flow with this ID or name already exists')
    const flowId = crypto.randomUUID(), eventId = crypto.randomUUID(), actionId = crypto.randomUUID(), refreshId = crypto.randomUUID(), successId = crypto.randomUUID(), errorId = crypto.randomUUID()
    const flow: Flow = {
      id: flowId,
      name,
      nodes: [
        { id: eventId, type: 'event', label: action === 'delete' ? 'Deletion confirmed' : 'Record updated', position: { x: 40, y: 80 }, config: { trigger: event, componentId: component.id } },
        { id: actionId, type: action, label: `${action === 'delete' ? 'Delete' : 'Update'} ${entity}`, position: { x: 270, y: 80 }, config: { sourceId } },
        { id: refreshId, type: 'refresh', label: `Refresh ${component.name}`, position: { x: 500, y: 80 }, config: { componentId: component.id } },
        { id: successId, type: 'notify', label: `${entity} ${action === 'delete' ? 'deleted' : 'updated'}`, position: { x: 730, y: 40 }, config: { message: action === 'delete' ? `${entity} deleted. Undo is available.` : `${entity} updated.`, level: 'success' } },
        { id: errorId, type: 'notify', label: `${entity} action failed`, position: { x: 500, y: 210 }, config: { message: `${entity} could not be ${action === 'delete' ? 'deleted' : 'updated'}.`, level: 'error' } },
      ],
      edges: [
        { id: crypto.randomUUID(), source: eventId, target: actionId, path: 'success' },
        { id: crypto.randomUUID(), source: actionId, target: refreshId, path: 'success' },
        { id: crypto.randomUUID(), source: actionId, target: errorId, path: 'error' },
        { id: crypto.randomUUID(), source: refreshId, target: successId, path: 'success' },
        { id: crypto.randomUUID(), source: refreshId, target: errorId, path: 'error' },
      ],
    }
    return parseProject({
      ...project,
      flows: [...project.flows, flow],
      pages: project.pages.map((page) => page.id === pageId ? { ...page, components: page.components.map((item) => item.id === component.id ? { ...item, events: { ...item.events, [event]: flowId } } : item) } : page),
    })
  }
  if (operation.type === 'compose_native_action') {
    const { component } = componentIn(project, pageId, args.componentId)
    const capabilityId = String(args.capability ?? ''), actionId = String(args.action ?? ''), capability = nativeCapability(capabilityId), action = nativeAction(capabilityId, actionId)
    if (!capability || !action) throw new Error('Choose a registered native capability and action')
    const targetPlatform = project.exportConfig.target === 'android' ? 'android' : 'web'
    if (!capability.platforms.includes(targetPlatform)) throw new Error(`${capability.label} is not available for this project target`)
    const eventName = String(args.event ?? 'click')
    if (component.events[eventName]) return project
    const name = `${action.label} · ${component.name}`
    if (project.flows.some((flow) => flow.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('A flow with this ID or name already exists')
    const flowId = crypto.randomUUID(), eventId = crypto.randomUUID(), permissionId = crypto.randomUUID(), nativeId = crypto.randomUUID(), updateId = crypto.randomUUID(), successId = crypto.randomUUID(), errorId = crypto.randomUUID()
    const permission = String(args.permission ?? capability.permissions[0] ?? '')
    const resultComponentId = String(args.resultComponentId ?? '')
    const nodes: Flow['nodes'] = [
      { id: eventId, type: 'event', label: `${component.name} · ${eventName}`, position: { x: 40, y: 80 }, config: { trigger: eventName, componentId: component.id } },
      ...(permission ? [{ id: permissionId, type: 'requestPermission' as const, label: `Request ${permission}`, position: { x: 250, y: 80 }, config: { permission, rationale: String(args.rationale ?? `${capability.label} needs ${permission} access.`) } }] : []),
      { id: nativeId, type: 'nativeAction', label: action.label, position: { x: permission ? 470 : 250, y: 80 }, config: { capability: capabilityId, action: actionId } },
      ...(resultComponentId ? [{ id: updateId, type: 'updateUI' as const, label: 'Show native result', position: { x: permission ? 690 : 470, y: 80 }, config: { componentId: resultComponentId, operation: 'value', value: '{{value}}' } }] : []),
      { id: successId, type: 'notify', label: `${action.label} completed`, position: { x: resultComponentId ? 910 : permission ? 690 : 470, y: 40 }, config: { message: String(args.successMessage ?? `${action.label} completed.`), level: 'success' } },
      { id: errorId, type: 'notify', label: `${action.label} failed`, position: { x: permission ? 470 : 250, y: 220 }, config: { message: String(args.errorMessage ?? `${action.label} could not be completed.`), level: 'error' } },
    ]
    const firstActionId = permission ? permissionId : nativeId, afterNativeId = resultComponentId ? updateId : successId
    const edges: Flow['edges'] = [
      { id: crypto.randomUUID(), source: eventId, target: firstActionId, path: 'success' },
      ...(permission ? [{ id: crypto.randomUUID(), source: permissionId, target: nativeId, path: 'success' }, { id: crypto.randomUUID(), source: permissionId, target: errorId, path: 'error' }] : []),
      { id: crypto.randomUUID(), source: nativeId, target: afterNativeId, path: 'success' },
      { id: crypto.randomUUID(), source: nativeId, target: errorId, path: 'error' },
      ...(resultComponentId ? [{ id: crypto.randomUUID(), source: updateId, target: successId, path: 'success' }, { id: crypto.randomUUID(), source: updateId, target: errorId, path: 'error' }] : []),
    ]
    const flow: Flow = { id: flowId, name, nodes, edges }
    return parseProject({ ...project, flows: [...project.flows, flow], pages: project.pages.map((page) => page.id === pageId ? { ...page, components: page.components.map((item) => item.id === component.id ? { ...item, events: { ...item.events, [eventName]: flowId } } : item) } : page) })
  }
  if (operation.type === 'add_flow') {
    const name = String(args.name ?? '').trim(), flowId = String(args.flowId ?? crypto.randomUUID())
    if (!name) throw new Error('Flow name is required')
    if (project.flows.some((flow) => flow.id === flowId || flow.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('A flow with this ID or name already exists')
    return parseProject({ ...project, flows: [...project.flows, { id: flowId, name, nodes: [], edges: [] }] })
  }
  if (operation.type === 'update_flow') {
    const flowId = String(args.flowId), name = String(args.name ?? '').trim()
    if (!name || !project.flows.some((flow) => flow.id === flowId)) throw new Error('Invalid flow')
    return parseProject({ ...project, flows: project.flows.map((flow) => flow.id === flowId ? { ...flow, name } : flow) })
  }
  if (operation.type === 'replace_flow') {
    const flow = args.flow as Flow
    if (!flow || !project.flows.some((item) => item.id === flow.id)) throw new Error('Invalid flow')
    return parseProject({ ...project, flows: project.flows.map((item) => item.id === flow.id ? flow : item) })
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
