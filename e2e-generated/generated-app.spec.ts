import { expect, test } from '@playwright/test'

test('l’app esportata si avvia e usa il proprio IndexedDB', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Titolo')
  await page.getByLabel('Nuova attività').fill('Record nell’app esportata')
  await page.getByRole('button', { name: 'Aggiungi' }).click()
  await expect(page.getByText('RECORD NELL’APP ESPORTATA')).toBeVisible()
  await page.screenshot({ path: 'artifacts/generated-app-flow-module.png', fullPage: true })
  expect(errors).toEqual([])
})
