import { expect, test } from '@playwright/test'

test('onboarding Android e verifica ambiente restano interamente visuali', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: /Android app/ }).check()
  await page.getByLabel('Theme color').fill('#2255aa')
  await page.getByLabel('Project name').fill(`Android Guided ${Date.now()}`)
  await page.getByRole('button', { name: 'Landing page Hero, features, CTA, and footer' }).click()

  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('button', { name: /^Android Native app/ })).toHaveClass(/active/)
  await expect(page.getByLabel('Package ID')).toHaveValue(/^studio\.kyro\.androidguided/)
  await expect(page.getByLabel('Theme color')).toHaveValue('#2255aa')
  await page.getByRole('button', { name: 'Check tools' }).click()
  await expect(page.locator('.environment-list')).toContainText('Java')
  await expect(page.locator('.environment-list')).toContainText('Android SDK')

  await page.getByRole('button', { name: 'PWA' }).click()
  await expect(page.getByText('Installable PWA ready')).toBeVisible()
})
