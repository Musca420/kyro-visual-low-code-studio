import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

test('apre Codex dal componente con contesto stabile e bridge protetto', async ({ page, request }) => {
  await page.goto('/')
  await page.getByLabel('Project name').fill(`Codex Context ${Date.now()}`)
  await page.getByRole('button', { name: 'Blank project Start with a clean canvas' }).click()
  await page.getByRole('button', { name: 'Add page' }).first().click()
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator('.palette button').filter({ hasText: 'button' }).click()

  const component = page.getByTestId('component-button')
  await component.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: /Actions for Button/ })
  await expect(menu.getByRole('menuitem')).toHaveCount(8)
  await menu.getByRole('menuitem', { name: /Ask Codex/ }).click()

  const panel = page.getByRole('region', { name: 'Codex assistant' })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Button')
  await expect(panel).toContainText('rev. 2')
  await expect(panel.getByRole('button', { name: 'Sign out of Codex' })).toBeVisible()
  await expect(panel.getByLabel('Request in plain language')).toBeFocused()
  const detailTabs = panel.getByRole('navigation', { name: 'Codex operation details' })
  await expect(detailTabs.getByRole('button')).toHaveCount(5)
  await detailTabs.getByRole('button', { name: 'Operations' }).hover()
  await expect(page.getByRole('tooltip')).toContainText('commands run')
  await detailTabs.getByRole('button', { name: 'Files and diff' }).click()
  await expect(panel).toContainText('No files changed')
  await detailTabs.getByRole('button', { name: 'Conversation' }).click()
  await page.screenshot({ path: 'artifacts/guided-codex-details.png', fullPage: true })

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

  const beforeWrap = await (await request.get(`/api/live/status?projectId=${projectId}`)).json()
  const wrap = await request.post('/api/live/tools/wrap_component', { data: { projectId: live.projectId, pageId: live.pageId, revision: beforeWrap.revision, args: { componentId: live.selectedComponentIds[0], componentType: 'stack', name: 'Azioni' } } })
  expect(wrap.status()).toBe(202)
  const wrapId = (await wrap.json()).transactionId
  await expect.poll(async () => (await (await request.get(`/api/live/transactions/${wrapId}`)).json()).status).toBe('applied')
  let wrapper: { id: string; children: { id: string }[] } | undefined
  await expect.poll(async () => { const nestedState = await (await request.get(`/api/live/status?projectId=${projectId}`)).json(); wrapper = nestedState.componentTree.find((item: { name: string }) => item.name === 'Azioni'); return Boolean(wrapper) }).toBe(true)
  if (!wrapper) throw new Error('Wrapper Azioni non pubblicato dal bridge')
  expect(wrapper.children.map((item: { id: string }) => item.id)).toContain(live.selectedComponentIds[0])
  await expect(page.locator(`[data-component-id="${wrapper.id}"] [data-component-id="${live.selectedComponentIds[0]}"]`)).toBeVisible()
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.frameLocator('.preview-frame').locator(`[data-component="${wrapper.id}"] [data-component="${live.selectedComponentIds[0]}"]`)).toBeVisible()

  const captureState = await (await request.get(`/api/live/status?projectId=${projectId}`)).json()
  for (const tool of ['capture_canvas', 'capture_preview']) {
    const capture = await request.post(`/api/live/tools/${tool}`, { data: { projectId: live.projectId, pageId: live.pageId, revision: captureState.revision, args: {} } })
    expect(capture.status()).toBe(202)
    const captureId = (await capture.json()).transactionId
    await expect.poll(async () => (await (await request.get(`/api/live/transactions/${captureId}`)).json()).status, { timeout: 15_000, message: `${tool} must finish` }).not.toBe('pending')
    const transaction = await (await request.get(`/api/live/transactions/${captureId}`)).json()
    expect(transaction.status, `${tool}: ${transaction.error || 'errore sconosciuto'}`).toBe('applied')
    const result = transaction.result
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/)
    expect(result.dataUrl.length).toBeGreaterThan(1_000)
    expect(result.width).toBeGreaterThan(100)
    expect(result.height).toBeGreaterThan(100)
    await writeFile(`artifacts/live-${tool.replace('capture_', '')}-capture.png`, Buffer.from(result.dataUrl.split(',')[1], 'base64'))
  }

  const stale = await request.post('/api/codex/run', { data: { mode: 'plan', prompt: 'Spiega', context: {}, projectId: live.projectId, revision: live.revision - 1 } })
  expect(stale.status()).toBe(409)
  await expect(stale.json()).resolves.toMatchObject({ error: /progetto è cambiato/i })
})
