import { expect, test } from '@playwright/test'

test('genera e compila Android esclusivamente dal percorso guidato', async ({ page }) => {
  test.setTimeout(900_000)
  test.skip(process.env.RUN_ANDROID_E2E !== '1', 'Build Android completa eseguita nel collaudo dedicato')
  await page.goto('/')
  await page.getByRole('radio', { name: /Applicazione Android/ }).check()
  await page.getByLabel('Nome progetto').fill(`Android Build ${Date.now()}`)
  await page.locator('.template').filter({ hasText: 'Lista' }).click()
  await page.getByRole('button', { name: 'Pubblica' }).click()
  await page.getByRole('button', { name: 'Verifica strumenti' }).click()
  await expect(page.locator('.environment-list li').filter({ hasText: 'Java' })).toHaveClass(/ok/)
  await expect(page.locator('.environment-list li').filter({ hasText: 'Android SDK' })).toHaveClass(/ok/)
  await page.getByRole('button', { name: 'Prepara progetto Android' }).click()
  const status = page.locator('.android-result')
  let finalJob: { status?: string; error?: string; apk?: string } = {}
  await expect.poll(async () => {
    finalJob = await page.evaluate(async () => {
      const jobs = await fetch('/api/android/jobs').then((response) => response.json())
      return jobs.at(-1) ?? {}
    })
    return finalJob.status
  }, { timeout: 900_000 }).toMatch(/completed|error/)
  expect(finalJob, JSON.stringify(finalJob)).toMatchObject({ status: 'completed' })
  expect(finalJob.apk).toMatch(/app-debug\.apk$/)
  await expect(status).toContainText('Progetto Android pronto')
  await expect(status).toContainText('APK:')
})
