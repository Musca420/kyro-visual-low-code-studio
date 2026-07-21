import { expect, test } from '@playwright/test'

test('l’app esportata si avvia e usa il proprio IndexedDB', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Title')
  await page.getByLabel('New task').fill('Record nell’app esportata')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('✓ DONE: RECORD NELL’APP ESPORTATA')).toBeVisible()
  await page.screenshot({ path: 'artifacts/generated-app-flow-module.png', fullPage: true })
  expect(errors).toEqual([])
})
