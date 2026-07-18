import { expect, test } from '@playwright/test'

test('onboarding Android e verifica ambiente restano interamente visuali', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: /Applicazione Android/ }).check()
  await page.getByLabel('Colore tema').fill('#2255aa')
  await page.getByLabel('Nome progetto').fill(`Android Guided ${Date.now()}`)
  await page.getByRole('button', { name: 'Landing page Hero, feature, CTA e footer' }).click()

  await page.getByRole('button', { name: 'Pubblica' }).click()
  await expect(page.getByRole('button', { name: /Android App nativa/ })).toHaveClass(/active/)
  await expect(page.getByLabel('Package ID')).toHaveValue(/^com\.frontendeditor\.androidguided/)
  await expect(page.getByLabel('Colore tema')).toHaveValue('#2255aa')
  await page.getByRole('button', { name: 'Verifica strumenti' }).click()
  await expect(page.locator('.environment-list')).toContainText('Java')
  await expect(page.locator('.environment-list')).toContainText('Android SDK')

  await page.getByRole('button', { name: 'PWA' }).click()
  await expect(page.getByText('PWA pronta da installare')).toBeVisible()
})
