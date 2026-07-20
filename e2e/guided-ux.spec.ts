import { expect, test } from '@playwright/test'

test('spiega i controlli e guida un utente inesperto', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Project name').fill(`Guided UX ${Date.now()}`)
  await page.getByRole('button', { name: 'Blank project Start with a clean canvas' }).hover()
  await expect(page.getByRole('tooltip')).toContainText('Blank project')
  await page.getByRole('button', { name: 'Blank project Start with a clean canvas' }).click()

  const guide = page.getByRole('complementary', { name: 'Guided path' })
  await expect(guide.locator(':scope > strong')).toHaveText('Create a page')
  await page.getByRole('button', { name: 'Add page' }).first().click()
  await page.getByRole("button", { name: "Create screen" }).click();
  await expect(guide.locator(':scope > strong')).toHaveText('Connect data')
  const buttonComponent = page.locator('.palette button').filter({ hasText: 'button' })
  await buttonComponent.hover()
  await expect(page.getByRole('tooltip')).toContainText('Add button to the page')
  await buttonComponent.click()
  await expect(guide.locator(':scope > strong')).toHaveText('Connect data')

  await page.getByRole('button', { name: 'Flow' }).hover()
  await expect(page.getByRole('tooltip')).toContainText('Define what happens')
  await page.getByRole('button', { name: 'Data' }).click()
  await expect(page.getByRole('heading', { name: 'Data & integrations' })).toBeVisible()
})
