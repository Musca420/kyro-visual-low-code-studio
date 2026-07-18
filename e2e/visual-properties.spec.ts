import { expect, test } from '@playwright/test'

test('un utente configura layout responsive e hover senza CSS', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Nome progetto').fill(`Visual controls ${Date.now()}`)
  await page.getByRole('button', { name: 'Progetto vuoto Parti da una tela pulita' }).click()
  await page.getByRole('button', { name: 'Aggiungi pagina' }).first().click()
  await page.locator('.palette button').filter({ hasText: 'button' }).click()

  const inspector = page.locator('.right-panel')
  await expect(inspector.getByText('Dimensioni e responsive')).toBeVisible()
  await inspector.getByLabel('Larghezza', { exact: true }).fill('240px')
  await inspector.getByLabel('Aspetto da modificare').selectOption('hover')
  await inspector.getByText('Effetti e animazioni').click()
  await inspector.getByLabel('Trasformazione').fill('scale(1.08)')
  await inspector.getByLabel('Ombra pronta').selectOption({ label: 'Morbida' })

  const canvasButton = page.getByTestId('component-button')
  await canvasButton.hover()
  await expect(canvasButton).toHaveCSS('transform', 'matrix(1.08, 0, 0, 1.08, 0, 0)')

  await inspector.getByLabel('Aspetto da modificare').selectOption('base')
  await page.locator('.canvas-toolbar .segmented').getByRole('button', { name: 'mobile' }).click()
  await inspector.getByLabel(/layout/).selectOption('none')
  await expect(canvasButton).toBeHidden()

  await page.getByRole('button', { name: 'desktop' }).first().click()
  await page.getByRole('button', { name: 'Preview' }).click()
  const previewButton = page.frameLocator('.preview-frame').getByRole('button', { name: 'Aggiungi' })
  await previewButton.hover()
  await expect(previewButton).toHaveCSS('transform', 'matrix(1.08, 0, 0, 1.08, 0, 0)')
})
