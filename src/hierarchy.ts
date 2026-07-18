import { containerTypes, type EditorComponent } from './model'

export type ComponentBranch = { component: EditorComponent; children: ComponentBranch[] }

export const canContain = (component: EditorComponent) => (containerTypes as readonly string[]).includes(component.type)

export function componentTree(components: EditorComponent[], parentId?: string): ComponentBranch[] {
  return components.filter((component) => component.parentId === parentId).map((component) => ({ component, children: componentTree(components, component.id) }))
}

export function descendantIds(components: EditorComponent[], componentId: string): Set<string> {
  const ids = new Set<string>()
  const visit = (parentId: string) => components.filter((component) => component.parentId === parentId).forEach((child) => { ids.add(child.id); visit(child.id) })
  visit(componentId)
  return ids
}

export function componentPath(components: EditorComponent[], componentId: string): EditorComponent[] {
  const path: EditorComponent[] = []
  let current = components.find((component) => component.id === componentId)
  while (current) { path.unshift(current); current = current.parentId ? components.find((component) => component.id === current!.parentId) : undefined }
  return path
}
