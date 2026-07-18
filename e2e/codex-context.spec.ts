import { expect, test } from '@playwright/test'

test('apre Codex dal componente con contesto stabile e bridge protetto', async ({ page, request }) => {
  await page.goto('/')
  await page.getByLabel('Nome progetto').fill(`Codex Context ${Date.now()}`)
  await page.getByRole('button', { name: 'Progetto vuoto Parti da una tela pulita' }).click()
  await page.getByRole('button', { name: 'Aggiungi pagina' }).first().click()
  await page.locator('.palette button').filter({ hasText: 'button' }).click()

  const component = page.getByTestId('component-button')
  await component.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: /Azioni per Button/ })
  await expect(menu.getByRole('menuitem')).toHaveCount(8)
  await menu.getByRole('menuitem', { name: /Chiedi a Codex/ }).click()

  const panel = page.getByRole('region', { name: 'Assistente Codex' })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Button')
  await expect(panel).toContainText('rev. 2')
  await expect(panel.getByLabel('Richiesta in linguaggio naturale')).toBeFocused()

  const projectId = await page.locator('.app-shell').getAttribute('data-project-id')
  await expect.poll(async () => (await request.get(`/api/live/status?projectId=${projectId}`)).status()).toBe(200)
  const live = await (await request.get(`/api/live/status?projectId=${projectId}`)).json()
  expect(live.projectId).toBeTruthy()
  expect(live.selectedComponentIds).toHaveLength(1)
  expect(live.componentTree.some((item: { id: string }) => item.id === live.selectedComponentIds[0])).toBe(true)

  const mutation = await request.post('/api/live/tools/set_component_style', { data: { projectId: live.projectId, pageId: live.pageId, revision: live.revision, args: { componentId: live.selectedComponentIds[0], property: 'background', value: '#ff0000' } } })
  expect(mutation.status()).toBe(202)
  const { transactionId } = await mutation.json()
  await expect.poll(async () => (await (await request.get(`/api/live/transactions/${transactionId}`)).json()).status).toBe('applied')
  await expect(component).toHaveCSS('background-color', 'rgb(255, 0, 0)')
  await expect.poll(async () => (await (await request.get(`/api/live/status?projectId=${projectId}`)).json()).revision).toBe(live.revision + 1)

  const current = await (await request.get(`/api/live/status?projectId=${projectId}`)).json()
  const undo = await request.post('/api/live/tools/undo_last_transaction', { data: { projectId: live.projectId, pageId: live.pageId, revision: current.revision, args: {} } })
  const undoId = (await undo.json()).transactionId
  await expect.poll(async () => (await (await request.get(`/api/live/transactions/${undoId}`)).json()).status).toBe('applied')
  await expect(component).not.toHaveCSS('background-color', 'rgb(255, 0, 0)')
  await expect.poll(async () => (await (await request.get(`/api/live/status?projectId=${projectId}`)).json()).revision).toBe(live.revision + 2)

  const stale = await request.post('/api/codex/run', { data: { mode: 'plan', prompt: 'Spiega', context: {}, projectId: live.projectId, revision: live.revision - 1 } })
  expect(stale.status()).toBe(409)
  await expect(stale.json()).resolves.toMatchObject({ error: /progetto è cambiato/i })
})
