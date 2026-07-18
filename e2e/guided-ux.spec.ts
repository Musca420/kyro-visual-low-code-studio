import { expect, test } from '@playwright/test'

test('spiega i controlli e guida un utente inesperto', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Nome progetto').fill(`Guided UX ${Date.now()}`)
  await page.getByRole('button', { name: 'Progetto vuoto Parti da una tela pulita' }).hover()
  await expect(page.getByRole('tooltip')).toContainText('Progetto vuoto')
  await page.getByRole('button', { name: 'Progetto vuoto Parti da una tela pulita' }).click()

  const guide = page.getByRole('complementary', { name: 'Percorso guidato' })
  await expect(guide.locator(':scope > strong')).toHaveText('Crea una pagina')
  await page.getByRole('button', { name: 'Aggiungi pagina' }).first().click()
  await expect(guide.locator(':scope > strong')).toHaveText('Aggiungi elementi')
  const buttonComponent = page.locator('.palette button').filter({ hasText: 'button' })
  await buttonComponent.hover()
  await expect(page.getByRole('tooltip')).toContainText('Aggiungi button alla pagina')
  await buttonComponent.click()
  await expect(guide.locator(':scope > strong')).toHaveText('Collega i dati')

  await page.getByRole('button', { name: 'Flow' }).hover()
  await expect(page.getByRole('tooltip')).toContainText('Definisci cosa accade')
  await page.getByRole('button', { name: 'Dati' }).click()
  await expect(page.getByRole('heading', { name: 'Dati & integrazioni' })).toBeVisible()
})
