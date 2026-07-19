import { describe, expect, it, vi } from 'vitest'
import { runFlow, safeHttpUrl } from '../src/flow'
import type { Flow } from '../src/model'

const flow: Flow = {
  id: 'flow', name: 'Create',
  nodes: [
    { id: 'event', type: 'event', label: 'Click', position: { x: 0, y: 0 }, config: {} },
    { id: 'read', type: 'readInput', label: 'Read', position: { x: 1, y: 0 }, config: { componentId: 'input' } },
    { id: 'validate', type: 'validate', label: 'Required', position: { x: 2, y: 0 }, config: { message: 'Required' } },
    { id: 'insert', type: 'insert', label: 'Insert', position: { x: 3, y: 0 }, config: { sourceId: 'db' } },
    { id: 'refresh', type: 'refresh', label: 'Refresh', position: { x: 4, y: 0 }, config: {} },
    { id: 'error', type: 'notify', label: 'Error', position: { x: 3, y: 1 }, config: {} },
  ],
  edges: [
    { id: '1', source: 'event', target: 'read', path: 'success' }, { id: '2', source: 'read', target: 'validate', path: 'success' },
    { id: '3', source: 'validate', target: 'insert', path: 'success' }, { id: '4', source: 'validate', target: 'error', path: 'error' },
    { id: '5', source: 'insert', target: 'refresh', path: 'success' }, { id: '6', source: 'insert', target: 'error', path: 'error' },
  ],
}

describe('flow runtime', () => {
  it('programma una notifica locale tramite il contesto tipizzato', async () => {
    const flow: Flow = { id: 'reminder', name: 'Promemoria', nodes: [
      { id: 'event', type: 'event', label: 'Click', position: { x: 0, y: 0 }, config: {} },
      { id: 'notification', type: 'localNotification', label: 'Programma', position: { x: 1, y: 0 }, config: { title: 'Promemoria', body: 'Controlla la giornata', delayMs: '2500' } },
    ], edges: [{ id: 'edge', source: 'event', target: 'notification', path: 'success' }] };
    const localNotification = vi.fn();
    await runFlow(flow, { input: '', insert: async () => undefined, refresh: async () => undefined, localNotification });
    expect(localNotification).toHaveBeenCalledWith('Promemoria', 'Controlla la giornata', 2500);
  });
  it('runs the success path deterministically', async () => {
    const insert = vi.fn(async (value: unknown) => ({ text: String(value) }))
    const refresh = vi.fn(async () => undefined)
    const logs = await runFlow(flow, { input: ' Ship it ', insert, refresh })
    expect(insert).toHaveBeenCalledWith('Ship it', 'db')
    expect(refresh).toHaveBeenCalledOnce()
    expect(logs.map((log) => log.nodeId)).toEqual(['event', 'read', 'validate', 'insert', 'refresh'])
  })

  it('uses the error path and never inserts invalid input', async () => {
    const insert = vi.fn(async () => undefined)
    const logs = await runFlow(flow, { input: '  ', insert, refresh: async () => undefined })
    expect(insert).not.toHaveBeenCalled()
    expect(logs.some((log) => log.level === 'error' && log.message === 'Required')).toBe(true)
    expect(logs.at(-1)?.nodeId).toBe('error')
  })

  it('stops uncontrolled loops', async () => {
    const cyclic: Flow = { id: 'cycle', name: 'cycle', nodes: [{ id: 'event', type: 'event', label: 'Event', position: { x: 0, y: 0 }, config: {} }], edges: [{ id: 'loop', source: 'event', target: 'event', path: 'success' }] }
    await expect(runFlow(cyclic, { input: '', insert: async () => undefined, refresh: async () => undefined })).rejects.toThrow('Loop non controllato')
  })

  it('routes timed out operations to the error path', async () => {
    const logs = await runFlow(flow, { input: 'slow', insert: () => new Promise(() => undefined), refresh: async () => undefined, timeoutMs: 10 })
    expect(logs.some((log) => log.level === 'error' && log.message === 'Timeout del flow')).toBe(true)
    expect(logs.at(-1)?.nodeId).toBe('error')
  })

  it('carica, filtra, ordina e calcola un KPI mostrando il valore attraversato', async () => {
    const nodes: Flow['nodes'] = [
      { id: 'start', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'query', type: 'query', label: 'Query', position: { x: 1, y: 0 }, config: { sourceId: 'db' } },
      { id: 'filter', type: 'filter', label: 'Filter', position: { x: 2, y: 0 }, config: { field: 'status', value: 'done' } },
      { id: 'sort', type: 'sort', label: 'Sort', position: { x: 3, y: 0 }, config: { field: 'name', direction: 'desc' } },
      { id: 'kpi', type: 'kpi', label: 'Count', position: { x: 4, y: 0 }, config: { operation: 'count' } },
      { id: 'notify', type: 'notify', label: 'Notify', position: { x: 5, y: 0 }, config: { message: 'Calcolo pronto', level: 'success' } },
    ]
    const visual: Flow = { id: 'visual', name: 'Visual', nodes, edges: nodes.slice(1).map((node, index) => ({ id: String(index), source: nodes[index].id, target: node.id, path: 'success' })) }
    const notify = vi.fn()
    const logs = await runFlow(visual, { input: '', insert: async () => undefined, refresh: async () => undefined, query: async () => [{ name: 'Alpha', status: 'done' }, { name: 'Beta', status: 'todo' }, { name: 'Gamma', status: 'done' }], notify })
    expect(logs.find((entry) => entry.nodeId === 'kpi')?.value).toBe(2)
    expect(notify).toHaveBeenCalledWith('Calcolo pronto', 'success')
  })

  it('dirama una condizione non verificata senza trasformarla in errore runtime', async () => {
    const conditional: Flow = { id: 'condition', name: 'Condition', nodes: [
      { id: 'start', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'condition', type: 'condition', label: 'Solo admin', position: { x: 1, y: 0 }, config: { field: '', operator: 'equals', value: 'admin' } },
      { id: 'yes', type: 'notify', label: 'Allowed', position: { x: 2, y: 0 }, config: { message: 'Sì' } },
      { id: 'no', type: 'notify', label: 'Denied', position: { x: 2, y: 1 }, config: { message: 'No' } },
    ], edges: [
      { id: '1', source: 'start', target: 'condition', path: 'success' },
      { id: '2', source: 'condition', target: 'yes', path: 'success' },
      { id: '3', source: 'condition', target: 'no', path: 'error' },
    ] }
    const notify = vi.fn()
    const logs = await runFlow(conditional, { input: 'viewer', insert: async () => undefined, refresh: async () => undefined, notify })
    expect(logs.some((entry) => entry.level === 'error')).toBe(false)
    expect(notify).toHaveBeenCalledWith('No', 'error')
  })

  it('esegue un modulo protetto come nodo del flow', async () => {
    const advanced: Flow = { id: 'advanced', name: 'Advanced', nodes: [
      { id: 'start', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'module', type: 'module', label: 'Pulisci', position: { x: 1, y: 0 }, config: { moduleId: 'clean' } },
      { id: 'log', type: 'log', label: 'Result', position: { x: 2, y: 0 }, config: {} },
    ], edges: [
      { id: '1', source: 'start', target: 'module', path: 'success' },
      { id: '2', source: 'module', target: 'log', path: 'success' },
    ] }
    const logs = await runFlow(advanced, { input: ' prova ', insert: async () => undefined, refresh: async () => undefined, runModule: (_id, value) => String(value).trim() })
    expect(logs.find((entry) => entry.nodeId === 'module')?.value).toBe('prova')
  })

  it('compone testo, conserva stato e attende senza bloccare il flow', async () => {
    const state = new Map<string, unknown>()
    const stateful: Flow = { id: 'state', name: 'State', nodes: [
      { id: 'event', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'format', type: 'format', label: 'Format', position: { x: 1, y: 0 }, config: { template: 'Ciao {{value}}' } },
      { id: 'set', type: 'setState', label: 'Save', position: { x: 2, y: 0 }, config: { key: 'greeting' } },
      { id: 'delay', type: 'delay', label: 'Wait', position: { x: 3, y: 0 }, config: { ms: '1' } },
      { id: 'get', type: 'getState', label: 'Read', position: { x: 4, y: 0 }, config: { key: 'greeting' } },
    ], edges: ['event', 'format', 'set', 'delay'].map((source, index) => ({ id: String(index), source, target: ['format', 'set', 'delay', 'get'][index], path: 'success' })) }
    const logs = await runFlow(stateful, { input: 'Canva', insert: async () => undefined, refresh: async () => undefined, getState: (key) => state.get(key), setState: (key, value) => state.set(key, value), resetState: (key) => void state.delete(key) })
    expect(logs.at(-1)?.value).toBe('Ciao Canva')
  })

  it('chiama un API senza accettare protocolli eseguibili', async () => {
    const api: Flow = { id: 'api', name: 'API', nodes: [
      { id: 'event', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'http', type: 'http', label: 'Create', position: { x: 1, y: 0 }, config: { url: 'https://api.example.test/items', method: 'POST', body: '{"name":"{{value}}"}' } },
    ], edges: [{ id: 'edge', source: 'event', target: 'http', path: 'success' }] }
    const request = vi.fn(async () => ({ id: '1' }))
    const logs = await runFlow(api, { input: 'Canva', insert: async () => undefined, refresh: async () => undefined, request })
    expect(request).toHaveBeenCalledWith('https://api.example.test/items', 'POST', '{"name":"Canva"}')
    expect(logs.at(-1)?.value).toEqual({ id: '1' })
    expect(() => safeHttpUrl('javascript:alert(1)')).toThrow('HTTP o HTTPS')
  })

  it('trasforma elenchi e lascia proseguire solo l’ultimo input ravvicinato', async () => {
    const visual: Flow = { id: 'debounced', name: 'Search', nodes: [
      { id: 'event', type: 'event', label: 'Input', position: { x: 0, y: 0 }, config: {} },
      { id: 'debounce', type: 'debounce', label: 'Wait', position: { x: 1, y: 0 }, config: { ms: '15' } },
      { id: 'query', type: 'query', label: 'Load', position: { x: 2, y: 0 }, config: {} },
      { id: 'map', type: 'map', label: 'Labels', position: { x: 3, y: 0 }, config: { field: 'name', template: 'Progetto: {{value}}' } },
      { id: 'notify', type: 'notify', label: 'Done', position: { x: 4, y: 0 }, config: { message: 'Pronto' } },
    ], edges: ['event', 'debounce', 'query', 'map'].map((source, index) => ({ id: String(index), source, target: ['debounce', 'query', 'map', 'notify'][index], path: 'success' })) }
    const notify = vi.fn(), context = { insert: async () => undefined, refresh: async () => undefined, query: async () => [{ name: 'Aurora' }], notify }
    const first = runFlow(visual, { ...context, input: 'a' })
    const second = runFlow(visual, { ...context, input: 'au' })
    const [, latest] = await Promise.all([first, second])
    expect(notify).toHaveBeenCalledOnce()
    expect(latest.find((entry) => entry.nodeId === 'map')?.value).toEqual(['Progetto: Aurora'])
  })

  it('segue una porta distinta per ogni caso dello switch', async () => {
    const choose: Flow = { id: 'switch', name: 'Choose', nodes: [
      { id: 'event', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'switch', type: 'switch', label: 'Status', position: { x: 1, y: 0 }, config: { field: 'status', cases: 'todo,done' } },
      { id: 'done', type: 'notify', label: 'Done', position: { x: 2, y: 0 }, config: { message: 'Completato' } },
      { id: 'other', type: 'notify', label: 'Other', position: { x: 2, y: 1 }, config: { message: 'Altro' } },
    ], edges: [
      { id: '1', source: 'event', target: 'switch', path: 'success' },
      { id: '2', source: 'switch', target: 'done', path: 'case:done' },
      { id: '3', source: 'switch', target: 'other', path: 'error' },
    ] }
    const notify = vi.fn()
    await runFlow(choose, { input: { status: 'done' }, insert: async () => undefined, refresh: async () => undefined, notify })
    expect(notify).toHaveBeenCalledWith('Completato', 'case:done')
  })

  it('ripete un ramo per ogni elemento entro un limite esplicito', async () => {
    const each: Flow = { id: 'loop', name: 'Each', nodes: [
      { id: 'event', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'loop', type: 'loop', label: 'Each', position: { x: 1, y: 0 }, config: { max: '3' } },
      { id: 'format', type: 'format', label: 'Format', position: { x: 2, y: 0 }, config: { template: 'Item {{value}}' } },
      { id: 'done', type: 'notify', label: 'Done', position: { x: 3, y: 0 }, config: { message: 'Fine' } },
    ], edges: [
      { id: '1', source: 'event', target: 'loop', path: 'success' },
      { id: '2', source: 'loop', target: 'format', path: 'each' },
      { id: '3', source: 'format', target: 'loop', path: 'success' },
      { id: '4', source: 'loop', target: 'done', path: 'done' },
    ] }
    const notify = vi.fn(), logs = await runFlow(each, { input: ['A', 'B'], insert: async () => undefined, refresh: async () => undefined, notify })
    expect(logs.filter((entry) => entry.nodeId === 'format').map((entry) => entry.value)).toEqual(['Item A', 'Item B'])
    expect(notify).toHaveBeenCalledOnce()
    const tooMany = structuredClone(each); tooMany.nodes.find((node) => node.type === 'loop')!.config.max = '1'
    expect((await runFlow(tooMany, { input: ['A', 'B'], insert: async () => undefined, refresh: async () => undefined })).some((entry) => entry.message.includes('limite di 1'))).toBe(true)
  })

  it('mette in pausa su un breakpoint e riprende solo su comando', async () => {
    const paused = structuredClone(flow)
    paused.nodes.find((node) => node.id === 'validate')!.config.breakpoint = 'true'
    let resume!: () => void
    const onBreakpoint = vi.fn(() => new Promise<void>((resolve) => { resume = resolve }))
    const insert = vi.fn(async () => undefined), execution = runFlow(paused, { input: 'Vai', insert, refresh: async () => undefined, onBreakpoint })
    await vi.waitFor(() => expect(onBreakpoint).toHaveBeenCalledWith('validate', 'Vai'))
    expect(insert).not.toHaveBeenCalled()
    resume()
    await execution
    expect(insert).toHaveBeenCalledOnce()
    paused.nodes.find((node) => node.id === 'validate')!.config = { ...paused.nodes.find((node) => node.id === 'validate')!.config, breakpointWhen: 'equals', breakpointValue: 'Altro' }
    onBreakpoint.mockClear()
    await runFlow(paused, { input: 'Vai', insert, refresh: async () => undefined, onBreakpoint })
    expect(onBreakpoint).not.toHaveBeenCalled()
  })

  it('cambia un elemento visuale attraverso un nodo guidato', async () => {
    const visual: Flow = { id: 'visual', name: 'Visual', nodes: [
      { id: 'event', type: 'event', label: 'Click', position: { x: 0, y: 0 }, config: {} },
      { id: 'ui', type: 'updateUI', label: 'Nascondi pannello', position: { x: 1, y: 0 }, config: { componentId: 'panel', operation: 'hide', value: '' } },
    ], edges: [{ id: 'edge', source: 'event', target: 'ui', path: 'success' }] }
    const updateUI = vi.fn()
    await runFlow(visual, { input: '', insert: async () => undefined, refresh: async () => undefined, updateUI })
    expect(updateUI).toHaveBeenCalledWith('panel', 'hide', '')
  })

  it('conserva tutti i campi di un record proveniente da un form', async () => {
    const create: Flow = { id: 'form', name: 'Form', nodes: [
      { id: 'event', type: 'event', label: 'Submit', position: { x: 0, y: 0 }, config: { trigger: 'submit' } },
      { id: 'insert', type: 'insert', label: 'Crea', position: { x: 1, y: 0 }, config: { sourceId: 'products' } },
    ], edges: [{ id: 'edge', source: 'event', target: 'insert', path: 'success' }] }
    const insert = vi.fn(async (value: unknown) => value)
    await runFlow(create, { input: { name: 'Lampada', price: 39, active: true }, insert, refresh: async () => undefined })
    expect(insert).toHaveBeenCalledWith({ name: 'Lampada', price: 39, active: true }, 'products')
  })

  it('valida un campo specifico di un record con regole guidate', async () => {
    const validated: Flow = { id: 'validate-record', name: 'Validate', nodes: [
      { id: 'event', type: 'event', label: 'Submit', position: { x: 0, y: 0 }, config: {} },
      { id: 'validate', type: 'validate', label: 'Email', position: { x: 1, y: 0 }, config: { field: 'email', rule: 'email', message: 'Email non valida' } },
      { id: 'insert', type: 'insert', label: 'Crea', position: { x: 2, y: 0 }, config: {} },
    ], edges: [{ id: '1', source: 'event', target: 'validate', path: 'success' }, { id: '2', source: 'validate', target: 'insert', path: 'success' }] }
    const insert = vi.fn(async (value: unknown) => value)
    expect((await runFlow(validated, { input: { email: 'no' }, insert, refresh: async () => undefined })).some((entry) => entry.message === 'Email non valida')).toBe(true)
    expect(insert).not.toHaveBeenCalled()
    await runFlow(validated, { input: { email: 'ok@example.com' }, insert, refresh: async () => undefined })
    expect(insert).toHaveBeenCalledOnce()
  })

  it('prepara e salva un file scelto dall’interfaccia senza perdere i metadati', async () => {
    const upload: Flow = { id: 'upload', name: 'Upload', nodes: [
      { id: 'event', type: 'event', label: 'File scelto', position: { x: 0, y: 0 }, config: { trigger: 'change' } },
      { id: 'file', type: 'file', label: 'Prepara file', position: { x: 1, y: 0 }, config: { maxMb: '1', accept: 'image/*' } },
      { id: 'insert', type: 'insert', label: 'Salva', position: { x: 2, y: 0 }, config: { sourceId: 'assets' } },
    ], edges: [{ id: '1', source: 'event', target: 'file', path: 'success' }, { id: '2', source: 'file', target: 'insert', path: 'success' }] }
    const insert = vi.fn(async (value: unknown) => value)
    const selected = new File(['pixel'], 'pixel.png', { type: 'image/png' })
    await runFlow(upload, { input: selected, insert, refresh: async () => undefined })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'pixel.png', type: 'image/png', size: 5, dataUrl: expect.stringMatching(/^data:image\/png;base64,/) }), 'assets')
    insert.mockClear()
    const rejected = await runFlow(upload, { input: new File(['testo'], 'note.txt', { type: 'text/plain' }), insert, refresh: async () => undefined })
    expect(insert).not.toHaveBeenCalled()
    expect(rejected.some((entry) => entry.message === 'Il tipo di file non è accettato')).toBe(true)
  })

  it('dirama i permessi per ruolo e chiude la sessione dal flow', async () => {
    const access: Flow = { id: 'access', name: 'Accesso', nodes: [
      { id: 'event', type: 'event', label: 'Click', position: { x: 0, y: 0 }, config: {} },
      { id: 'role', type: 'requireRole', label: 'Solo editor', position: { x: 1, y: 0 }, config: { roles: 'admin,editor', message: 'Accesso riservato' } },
      { id: 'logout', type: 'signOut', label: 'Esci', position: { x: 2, y: 0 }, config: {} },
      { id: 'denied', type: 'notify', label: 'Negato', position: { x: 2, y: 1 }, config: { message: 'Permesso mancante' } },
    ], edges: [{ id: '1', source: 'event', target: 'role', path: 'success' }, { id: '2', source: 'role', target: 'logout', path: 'success' }, { id: '3', source: 'role', target: 'denied', path: 'error' }] }
    const signOut = vi.fn(), notify = vi.fn()
    await runFlow(access, { input: '', insert: async () => undefined, refresh: async () => undefined, getRole: () => 'editor', signOut, notify })
    expect(signOut).toHaveBeenCalledOnce()
    await runFlow(access, { input: '', insert: async () => undefined, refresh: async () => undefined, getRole: () => 'viewer', signOut, notify })
    expect(signOut).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('Permesso mancante', 'error')
  })

  it('naviga a pagina, indietro o URL senza accettare protocolli pericolosi', async () => {
    const navigation: Flow = { id: 'navigation', name: 'Naviga', nodes: [
      { id: 'event', type: 'event', label: 'Click', position: { x: 0, y: 0 }, config: {} },
      { id: 'navigate', type: 'navigate', label: 'Vai', position: { x: 1, y: 0 }, config: { mode: 'page', path: '/dettaglio' } },
    ], edges: [{ id: 'edge', source: 'event', target: 'navigate', path: 'success' }] }
    const navigate = vi.fn()
    await runFlow(navigation, { input: '', insert: async () => undefined, refresh: async () => undefined, navigate })
    expect(navigate).toHaveBeenCalledWith('/dettaglio', 'page')
    navigation.nodes[1].config = { mode: 'back' }
    await runFlow(navigation, { input: '', insert: async () => undefined, refresh: async () => undefined, navigate })
    expect(navigate).toHaveBeenLastCalledWith('/', 'back')
    navigation.nodes[1].config = { mode: 'url', path: 'javascript:alert(1)' }
    expect((await runFlow(navigation, { input: '', insert: async () => undefined, refresh: async () => undefined, navigate })).some((entry) => entry.message === 'Usa un indirizzo API HTTP o HTTPS')).toBe(true)
  })

  it('apre e chiude la stessa modal dal nodo visuale', async () => {
    const modal: Flow = { id: 'modal', name: 'Modal', nodes: [
      { id: 'event', type: 'event', label: 'Click', position: { x: 0, y: 0 }, config: {} },
      { id: 'modal', type: 'openModal', label: 'Modal', position: { x: 1, y: 0 }, config: { componentId: 'dialog', operation: 'close' } },
    ], edges: [{ id: 'edge', source: 'event', target: 'modal', path: 'success' }] }
    const openModal = vi.fn()
    await runFlow(modal, { input: '', insert: async () => undefined, refresh: async () => undefined, openModal })
    expect(openModal).toHaveBeenCalledWith('dialog', 'close')
    modal.nodes[1].config.operation = 'open'
    await runFlow(modal, { input: '', insert: async () => undefined, refresh: async () => undefined, openModal })
    expect(openModal).toHaveBeenLastCalledWith('dialog', 'open')
  })

  it('carica un singolo record per ID dal valore o da un campo', async () => {
    const one: Flow = { id: 'get-one', name: 'Leggi record', nodes: [
      { id: 'event', type: 'event', label: 'Input', position: { x: 0, y: 0 }, config: {} },
      { id: 'query', type: 'query', label: 'Uno', position: { x: 1, y: 0 }, config: { mode: 'one', id: '{{value}}', field: 'projectId' } },
    ], edges: [{ id: 'edge', source: 'event', target: 'query', path: 'success' }] }
    const records = [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }]
    const logs = await runFlow(one, { input: { projectId: 'beta' }, insert: async () => undefined, refresh: async () => undefined, query: async () => records })
    expect(logs.at(-1)?.value).toEqual(records[1])
    expect(logs.every((log) => typeof log.durationMs === 'number' && log.durationMs >= 0)).toBe(true)
    const missing = await runFlow(one, { input: { projectId: 'missing' }, insert: async () => undefined, refresh: async () => undefined, query: async () => records })
    expect(missing.at(-1)?.message).toBe('Record missing non trovato')
  })

  it('esegue permessi, condizioni di piattaforma e capacità native come nodi generici', async () => {
    const native: Flow = { id: 'native', name: 'Device capability', nodes: [
      { id: 'event', type: 'event', label: 'Tap', position: { x: 0, y: 0 }, config: {} },
      { id: 'permission', type: 'requestPermission', label: 'Camera permission', position: { x: 1, y: 0 }, config: { permission: 'camera', rationale: 'Scan a code' } },
      { id: 'platform', type: 'platformCondition', label: 'Android 15+', position: { x: 2, y: 0 }, config: { platform: 'android', minVersion: '15' } },
      { id: 'camera', type: 'nativeAction', label: 'Take photo', position: { x: 3, y: 0 }, config: { capability: 'camera', action: 'takePhoto' } },
      { id: 'denied', type: 'notify', label: 'Denied', position: { x: 2, y: 1 }, config: { message: 'Permission denied' } },
    ], edges: [
      { id: '1', source: 'event', target: 'permission', path: 'success' },
      { id: '2', source: 'permission', target: 'platform', path: 'success' },
      { id: '3', source: 'permission', target: 'denied', path: 'error' },
      { id: '4', source: 'platform', target: 'camera', path: 'success' },
      { id: '5', source: 'platform', target: 'denied', path: 'error' },
    ] }
    const requestPermission = vi.fn(async () => true), nativeAction = vi.fn(async () => ({ path: 'photo.jpg' })), notify = vi.fn()
    const success = await runFlow(native, { input: '', insert: async () => undefined, refresh: async () => undefined, requestPermission, platformInfo: () => ({ platform: 'android', version: '15' }), nativeAction, notify })
    expect(requestPermission).toHaveBeenCalledWith('camera', 'Scan a code')
    expect(nativeAction).toHaveBeenCalledWith('camera', 'takePhoto', expect.objectContaining({ matches: true }), expect.objectContaining({ capability: 'camera' }))
    expect(success.at(-1)?.value).toEqual({ path: 'photo.jpg' })
    await runFlow(native, { input: '', insert: async () => undefined, refresh: async () => undefined, requestPermission: () => false, platformInfo: () => ({ platform: 'android', version: '15' }), nativeAction, notify })
    expect(notify).toHaveBeenCalledWith('Permission denied', 'error')
  })
})
