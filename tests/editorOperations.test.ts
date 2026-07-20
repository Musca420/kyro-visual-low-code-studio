import { describe, expect, it } from 'vitest'
import { applyEditorOperation } from '../src/editorOperations'
import { createProject, makeComponent } from '../src/model'

describe('structured editor operations', () => {
  it('applica una transazione atomica di proprietà e stile responsive', () => {
    const project = createProject('Live')
    const component = makeComponent('button')
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [component] })
    const next = applyEditorOperation(project, 'page', { type: 'apply_editor_transaction', args: { operations: [
      { type: 'set_component_property', args: { componentId: component.id, property: 'label', value: 'Salva' } },
      { type: 'set_responsive_style', args: { componentId: component.id, breakpoint: 'mobile', property: 'width', value: '100%' } },
    ] } })
    expect(next.pages[0].components[0].props.label).toBe('Salva')
    expect(next.pages[0].components[0].styles.mobile.width).toBe('100%')
    expect(project.pages[0].components[0].props.label).toBe('Add')
  })

  it('espande una composizione schermo compatta in componenti nativi responsive', () => {
    const project = createProject('Composer')
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [makeComponent('text')] })
    const next = applyEditorOperation(project, 'page', { type: 'compose_screen', args: {
      name: 'Customer dashboard', layout: 'mobile-dashboard', replaceExisting: true, confirmed: true, states: true,
      sections: [{ type: 'title', name: 'Greeting', label: 'Good morning' }, { type: 'grid', name: 'Services', label: 'Services', items: [{ type: 'card', name: 'Repair', label: 'Home repair' }] }],
      navigation: [{ label: 'Home', path: '/' }, { label: 'Profile', path: '/profile' }],
    } })
    const page = next.pages[0]
    expect(page.components.some((item) => item.name === 'Customer dashboard')).toBe(true)
    expect(page.components.some((item) => item.name === 'Repair' && item.type === 'card')).toBe(true)
    expect(page.components.filter((item) => ['skeleton', 'empty', 'alert'].includes(item.type))).toHaveLength(3)
    expect(page.components.find((item) => item.name === 'Primary navigation')?.styles.mobile.position).toBe('fixed')
    expect(page.components.find((item) => item.name === 'Greeting')?.styles.desktop.background).toBe('transparent')
    expect(page.components.find((item) => item.name === 'Customer dashboard')?.styles.mobile.background).toBe('#0f1115')
    expect(page.components.find((item) => item.name === 'Repair')?.styles.mobile.background).toBe('#171a21')
    expect(page.components.every((item) => item.id && item.accessibility.label)).toBe(true)
    expect(next.appConfig.mobileBottomNavigation).toEqual({ enabled: true, items: [{ label: 'Home', path: '/' }, { label: 'Profile', path: '/profile' }] })
  })

  it('rifiuta una rimozione non confermata', () => {
    const project = createProject('Safe')
    const component = makeComponent('button')
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [component] })
    expect(() => applyEditorOperation(project, 'page', { type: 'remove_component', args: { componentId: component.id } })).toThrow('confirmed=true')
  })

  it('normalizza la navigazione mobile proposta dall agente senza perdere la safe area', () => {
    const project = createProject('Navigation')
    const next = applyEditorOperation(project, 'page', { type: 'set_app_config', args: { patch: { navigation: { mobileBottomNavigation: { enabled: true, safeArea: true, items: [{ label: 'Home', path: '/' }] } } } } })
    expect(next.appConfig.safeArea).toBe(true)
    expect(next.appConfig.mobileBottomNavigation).toEqual({ enabled: true, items: [{ label: 'Home', path: '/' }] })
  })

  it('raggruppa, sposta e rimuove un sottoalbero senza creare cicli', () => {
    const project = createProject('Hierarchy')
    const button = makeComponent('button')
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [button] })
    const wrapped = applyEditorOperation(project, 'page', { type: 'wrap_component', args: { componentId: button.id, componentType: 'stack', name: 'Azioni' } })
    const stack = wrapped.pages[0].components.find((item) => item.type === 'stack')!
    expect(wrapped.pages[0].components.find((item) => item.id === button.id)?.parentId).toBe(stack.id)
    expect(() => applyEditorOperation(wrapped, 'page', { type: 'move_component', args: { componentId: stack.id, parentId: button.id } })).toThrow('would create a cycle')
    const nestedButton = wrapped.pages[0].components.find((item) => item.id === button.id)!
    nestedButton.styles.desktop.position = 'absolute'
    nestedButton.styles.desktop.left = '96px'
    const movedOut = applyEditorOperation(wrapped, 'page', { type: 'move_component', args: { componentId: button.id, parentId: null } })
    expect(movedOut.pages[0].components.find((item) => item.id === button.id)?.styles.desktop).toMatchObject({ position: 'relative', left: '0px', top: '0px' })
    const removed = applyEditorOperation(wrapped, 'page', { type: 'remove_component', args: { componentId: stack.id, confirmed: true } })
    expect(removed.pages[0].components).toHaveLength(0)
  })

  it('riordina e riposiziona un componente tra fratelli in una sola operazione', () => {
    const project = createProject('Reorder')
    const column = makeComponent('stack')
    const first = { ...makeComponent('button'), name: 'Uno', parentId: column.id }
    const second = { ...makeComponent('button'), name: 'Due', parentId: column.id }
    const third = { ...makeComponent('button'), name: 'Tre' }
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [column, first, second, third] })

    const moved = applyEditorOperation(project, 'page', {
      type: 'move_component',
      args: { componentId: third.id, parentId: column.id, index: 1 },
    })
    const siblings = moved.pages[0].components.filter((item) => item.parentId === column.id)

    expect(siblings.map((item) => item.name)).toEqual(['Uno', 'Tre', 'Due'])
    expect(siblings[1].styles.desktop).toMatchObject({ position: 'relative', left: '0px', top: '0px' })
    expect(project.pages[0].components.find((item) => item.id === third.id)?.parentId).toBeUndefined()
  })

  it('crea una schermata completa con componente, dati, flow e configurazione app', () => {
    const project = createProject('DailyFlow')
    project.pages.push({ id: 'home', name: 'Oggi', path: '/', components: [] })
    const next = applyEditorOperation(project, 'home', { type: 'apply_editor_transaction', args: { operations: [
      { type: 'add_page', args: { pageId: 'tasks', name: 'Attivita', path: '/attivita' } },
      { type: 'add_component', pageId: 'tasks', args: { componentId: 'task-title', componentType: 'title', name: 'Titolo attivita', props: { label: 'Attivita' }, styles: { mobile: { fontSize: '28px' } } } },
      { type: 'set_component_state_style', pageId: 'tasks', args: { componentId: 'task-title', state: 'focus', property: 'outline', value: '3px solid #22d3ee' } },
      { type: 'create_data_source', args: { sourceId: 'tasks-db', name: 'Attivita', provider: 'indexeddb', collection: 'tasks', schema: { id: 'string', title: 'string', completed: 'boolean' } } },
      { type: 'add_flow', args: { flowId: 'load-tasks', name: 'Carica attivita' } },
      { type: 'add_flow_node', args: { flowId: 'load-tasks', node: { id: 'load-event', type: 'event', label: 'Apertura pagina', position: { x: 0, y: 0 }, config: { trigger: 'pageLoad' } } } },
      { type: 'set_app_config', args: { patch: { offline: true } } },
      { type: 'set_export_config', args: { patch: { target: 'android', capacitor: true, android: { packageId: 'com.dailyflow.app', appName: 'DailyFlow', orientation: 'any', themeColor: '#123b5d', versionName: '1.0.0', versionCode: 1, permissions: ['notifications'], statusBarStyle: 'dark', keyboardResize: true, backButton: true } } } },
    ] } })

    expect(next.pages.find((page) => page.id === 'tasks')?.components[0]).toMatchObject({ id: 'task-title', props: { label: 'Attivita' } })
    expect(next.pages.find((page) => page.id === 'tasks')?.components[0].styles.mobile.fontSize).toBe('28px')
    expect(next.dataSources[0]).toMatchObject({ id: 'tasks-db', provider: 'indexeddb' })
    expect(next.flows[0].nodes[0].config.trigger).toBe('pageLoad')
    expect(next.appConfig.offline).toBe(true)
    expect(next.exportConfig.target).toBe('android')
  })

  it('rinomina un livello tramite la proprieta name', () => {
    const project = createProject('DailyFlow')
    const component = makeComponent('title')
    project.pages.push({ id: 'home', name: 'Oggi', path: '/', components: [component] })
    const renamed = applyEditorOperation(project, 'home', {
      type: 'set_component_property',
      args: { componentId: component.id, property: 'name', value: 'Saluto e data' },
    })
    expect(renamed.pages[0].components[0].name).toBe('Saluto e data')
  })

  it('collega e scollega un evento componente a un flow', () => {
    const project = createProject('DailyFlow')
    const form = makeComponent('form')
    project.pages.push({ id: 'tasks', name: 'Attivita', path: '/attivita', components: [form] })
    project.flows.push({ id: 'create-task', name: 'Crea attivita', nodes: [], edges: [] })
    const connected = applyEditorOperation(project, 'tasks', { type: 'set_component_event', args: { componentId: form.id, event: 'submit', flowId: 'create-task' } })
    expect(connected.pages[0].components[0].events.submit).toBe('create-task')
    const removed = applyEditorOperation(connected, 'tasks', { type: 'remove_component_event', args: { componentId: form.id, event: 'submit' } })
    expect(removed.pages[0].components[0].events.submit).toBeUndefined()
  })

  it('keeps visual flow names and IDs unique', () => {
    const project = createProject('Flows')
    project.pages.push({ id: 'home', name: 'Home', path: '/', components: [] })
    const created = applyEditorOperation(project, 'home', { type: 'add_flow', args: { flowId: 'save', name: 'Save item' } })
    expect(() => applyEditorOperation(created, 'home', { type: 'add_flow', args: { flowId: 'other', name: 'save ITEM' } })).toThrow('already exists')
    expect(() => applyEditorOperation(created, 'home', { type: 'add_flow', args: { flowId: 'save', name: 'Different' } })).toThrow('already exists')
  })

  it('expands a compact record delete action into native visual nodes', () => {
    const project = createProject('Records')
    const list = makeComponent('list'); list.id = 'records'; list.binding = { sourceId: 'items', state: 'data' }
    project.pages.push({ id: 'home', name: 'Home', path: '/', components: [list] })
    project.dataSources.push({ id: 'items', name: 'Items', provider: 'indexeddb', collection: 'items', schema: { name: 'string' }, capabilities: ['get', 'query', 'insert', 'update', 'delete', 'subscribe'], secretStrategy: 'none' })
    const next = applyEditorOperation(project, 'home', { type: 'compose_record_action', args: { componentId: 'records', action: 'delete', entity: 'Item' } })
    expect(next.flows).toHaveLength(1)
    expect(next.flows[0].nodes.map((node) => node.type)).toEqual(['event', 'delete', 'refresh', 'notify', 'notify'])
    expect(next.pages[0].components[0].events.recordDelete).toBe(next.flows[0].id)
    expect(applyEditorOperation(next, 'home', { type: 'compose_record_action', args: { componentId: 'records', action: 'delete', entity: 'Item' } }).flows).toHaveLength(1)
  })

  it('expands a registered device action and exposes its extension request', () => {
    const project = createProject('Native composer'); project.exportConfig.target = 'android'
    const button = makeComponent('button'); button.id = 'scanner'
    project.pages.push({ id: 'home', name: 'Home', path: '/', components: [button] })
    const next = applyEditorOperation(project, 'home', { type: 'compose_native_action', args: { componentId: 'scanner', capability: 'barcode', action: 'scanBarcode', permission: 'camera' } })
    expect(next.flows[0].nodes.map((node) => node.type)).toEqual(['event', 'requestPermission', 'nativeAction', 'notify', 'notify'])
    expect(next.flows[0].nodes.find((node) => node.type === 'nativeAction')?.config).toMatchObject({ capability: 'barcode', action: 'scanBarcode' })
    expect(next.pages[0].components[0].events.click).toBe(next.flows[0].id)
  })

  it('approves only an exact dependency requested by the visual flow', () => {
    const project = createProject('Native')
    project.pages.push({ id: 'home', name: 'Home', path: '/', components: [] })
    project.flows.push({ id: 'ble-flow', name: 'Scan', nodes: [{ id: 'scan', type: 'nativeAction', label: 'Scan devices', position: { x: 0, y: 0 }, config: { capability: 'bluetooth', action: 'scan' } }], edges: [] })

    expect(() => applyEditorOperation(project, 'home', { type: 'approve_dependency', args: { packageName: '@capacitor-community/bluetooth-le', version: '^8.0.0' } })).toThrow('confirmed=true')
    expect(() => applyEditorOperation(project, 'home', { type: 'approve_dependency', args: { packageName: '@evil/package', version: '^1.0.0', confirmed: true } })).toThrow('not required')

    const approved = applyEditorOperation(project, 'home', { type: 'approve_dependency', args: { packageName: '@capacitor-community/bluetooth-le', version: '^8.0.0', confirmed: true } })
    expect(approved.extensionApprovals).toEqual([expect.objectContaining({ packageName: '@capacitor-community/bluetooth-le', version: '^8.0.0', reason: 'Bluetooth Low Energy' })])
    const revoked = applyEditorOperation(approved, 'home', { type: 'revoke_dependency', args: { packageName: '@capacitor-community/bluetooth-le', confirmed: true } })
    expect(revoked.extensionApprovals).toHaveLength(0)
  })

  it('stores only reusable advanced modules with passing examples', () => {
    const project = createProject('Recipes')
    project.pages.push({ id: 'home', name: 'Home', path: '/', components: [] })
    const module = { id: 'clean-name', name: 'Clean name', description: 'Reusable text cleanup', inputType: 'string', outputType: 'string', operation: 'trim', config: {}, tests: [{ id: 'example', input: ' Ada ', expected: 'Ada' }] }
    const created = applyEditorOperation(project, 'home', { type: 'create_code_module', args: { module } })
    expect(created.codeModules).toEqual([expect.objectContaining({ id: 'clean-name' })])
    expect(() => applyEditorOperation(project, 'home', { type: 'create_code_module', args: { module: { ...module, tests: [{ id: 'bad', input: ' Ada ', expected: 'Grace' }] } } })).toThrow('passing test')
  })
})
