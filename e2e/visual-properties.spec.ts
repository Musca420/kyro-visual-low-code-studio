import { expect, test } from '@playwright/test'

test('un utente configura layout responsive e hover senza CSS', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Project name').fill(`Visual controls ${Date.now()}`)
  await page.getByRole('button', { name: 'Blank project Start with a clean canvas' }).click()
  await page.getByRole('button', { name: 'Add page' }).first().click()
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator('.palette button').filter({ hasText: 'button' }).click()

  const inspector = page.locator('.right-panel')
  await inspector.getByRole('button', { name: 'Advanced' }).click()
  await expect(inspector.getByText('Size and responsive')).toBeVisible()
  await inspector.getByLabel('Width', { exact: true }).fill('240px')
  await inspector.getByLabel('State to edit').selectOption('hover')
  await inspector.getByText('Effects and animations').click()
  await inspector.getByLabel('Transform').fill('scale(1.08)')
  await inspector.getByLabel('Shadow preset').selectOption({ label: 'Soft' })

  const canvasButton = page.getByTestId('component-button')
  await canvasButton.hover()
  await expect(canvasButton).toHaveCSS('transform', 'matrix(1.08, 0, 0, 1.08, 0, 0)')

  await inspector.getByLabel('State to edit').selectOption('base')
  await page.locator('.canvas-toolbar .segmented').getByRole('button', { name: 'mobile' }).click()
  await inspector.getByLabel(/layout/).selectOption('none')
  await expect(canvasButton).toBeHidden()

  await page.getByRole('button', { name: 'desktop' }).first().click()
  await page.getByRole('button', { name: 'Preview' }).click()
  const previewButton = page.frameLocator('.preview-frame').getByRole('button', { name: 'Add' })
  await previewButton.hover()
  await expect(previewButton).toHaveCSS('transform', 'matrix(1.08, 0, 0, 1.08, 0, 0)')
})
