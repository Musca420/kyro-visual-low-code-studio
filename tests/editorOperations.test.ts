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
    expect(project.pages[0].components[0].props.label).toBe('Aggiungi')
  })

  it('rifiuta una rimozione non confermata', () => {
    const project = createProject('Safe')
    const component = makeComponent('button')
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [component] })
    expect(() => applyEditorOperation(project, 'page', { type: 'remove_component', args: { componentId: component.id } })).toThrow('confirmed=true')
  })

  it('raggruppa, sposta e rimuove un sottoalbero senza creare cicli', () => {
    const project = createProject('Hierarchy')
    const button = makeComponent('button')
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [button] })
    const wrapped = applyEditorOperation(project, 'page', { type: 'wrap_component', args: { componentId: button.id, componentType: 'stack', name: 'Azioni' } })
    const stack = wrapped.pages[0].components.find((item) => item.type === 'stack')!
    expect(wrapped.pages[0].components.find((item) => item.id === button.id)?.parentId).toBe(stack.id)
    expect(() => applyEditorOperation(wrapped, 'page', { type: 'move_component', args: { componentId: stack.id, parentId: button.id } })).toThrow('creerebbe un ciclo')
    const removed = applyEditorOperation(wrapped, 'page', { type: 'remove_component', args: { componentId: stack.id, confirmed: true } })
    expect(removed.pages[0].components).toHaveLength(0)
  })
})
