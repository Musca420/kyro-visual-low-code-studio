import { chromium } from '@playwright/test'
import { resolve } from 'node:path'

const context = await chromium.launchPersistentContext(resolve('.live-browser-profile'), { headless: false, slowMo: 260, viewport: null, args: ['--start-maximized'] })
const page = context.pages()[0] ?? await context.newPage()
page.on('dialog', (dialog) => dialog.accept())
await page.goto('http://127.0.0.1:4173')

await page.getByLabel('Nome progetto').fill('Simple Landing Page')
await page.getByRole('button', { name: 'Landing page Hero, feature, CTA e footer' }).click()
await page.getByRole('button', { name: 'Flow' }).click()
await page.getByRole('button', { name: 'Crea interazioni landing' }).click()
await page.getByLabel('Flow attivo').selectOption({ label: 'Demo interattiva' })
await page.getByRole('button', { name: 'Preview' }).click()
const landing = page.frameLocator('iframe[title="Preview isolata"]')
await landing.getByRole('button', { name: 'Explore features' }).click()
await landing.getByRole('button', { name: 'See how it works' }).click()
await page.getByRole('button', { name: 'tablet' }).click()
await page.getByRole('button', { name: 'mobile' }).click()
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Chiudi progetto e torna alla dashboard' }).click()

await page.getByLabel('Nome progetto').fill('Project Management Dashboard')
await page.getByRole('button', { name: 'Project dashboard KPI, ricerca, filtri e CRUD' }).click()
await page.getByRole('button', { name: 'Dati' }).click()
await page.getByLabel('Nome', { exact: true }).fill('Projects database')
await page.getByLabel('Collezione', { exact: true }).fill('projects')
await page.getByRole('button', { name: 'Crea sorgente IndexedDB' }).click()
await page.getByRole('button', { name: 'Flow' }).click()
await page.getByRole('button', { name: 'Crea flow dashboard' }).click()
await page.getByLabel('Flow attivo').selectOption({ label: 'Crea progetto' })
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Preview' }).click()
const dashboard = page.frameLocator('iframe[title="Preview isolata"]')
const records = [
  ['Atlas Redesign', 'Refresh the customer workspace', 'In progress', 'High', '2026-08-10'],
  ['Mobile Launch', 'Prepare the mobile application launch', 'Planned', 'High', '2026-09-02'],
  ['Analytics v2', 'Ship the new reporting experience', 'Completed', 'Medium', '2026-07-30'],
  ['Billing Migration', 'Move accounts to the new billing stack', 'On hold', 'High', '2026-10-12'],
  ['Design System', 'Unify components and interaction patterns', 'In progress', 'Medium', '2026-08-25'],
]
for (const [name, description, status, priority, dueDate] of records) {
  await dashboard.getByRole('button', { name: /New project/ }).click()
  const form = dashboard.locator('#project-modal form')
  await form.getByLabel('Project name').fill(name)
  await form.getByLabel('Description').fill(description)
  await form.getByLabel('Status').selectOption(status)
  await form.getByLabel('Priority').selectOption(priority)
  await form.getByLabel('Due date').fill(dueDate)
  await form.getByRole('button', { name: 'Save project' }).click()
}
await dashboard.getByLabel('Search').fill('Atlas')
await page.waitForTimeout(700)
await dashboard.getByLabel('Search').fill('')
await page.waitForTimeout(700)

const landingExport = await context.newPage()
await landingExport.goto('http://127.0.0.1:4181')
const dashboardExport = await context.newPage()
await dashboardExport.goto('http://127.0.0.1:4182')
await page.bringToFront()
await new Promise((resolveClose) => context.on('close', resolveClose))
