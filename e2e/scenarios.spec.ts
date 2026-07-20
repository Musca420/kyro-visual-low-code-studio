import { expect, test, type FrameLocator, type Page } from '@playwright/test'

async function createDashboardRecord(frame: FrameLocator, record: { name: string; description: string; status: string; priority: string; dueDate: string }) {
  await frame.getByRole('button', { name: /New project/ }).click()
  const form = frame.locator('#project-modal form')
  await form.getByLabel('Project name').fill(record.name)
  await form.getByLabel('Description').fill(record.description)
  await form.getByLabel('Status').selectOption(record.status)
  await form.getByLabel('Priority').selectOption(record.priority)
  await form.getByLabel('Due date').fill(record.dueDate)
  await form.getByRole('button', { name: 'Save project' }).click()
  await expect(frame.getByText(record.name, { exact: true })).toBeVisible()
}

async function openProject(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(name) }).click()
}

test('real user scenarios: refined landing and project dashboard CRUD', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => { errors.push(error.message); console.log('PAGE ERROR:', error.message) })
  await page.goto('/')

  // Scenario 1 — create only through dashboard/editor actions.
  await page.getByLabel('Project name').fill('Simple Landing Page')
  await page.getByRole('button', { name: 'Landing page Hero, features, CTA, and footer' }).click()
  await expect(page.getByText('Hero title')).toBeVisible()
  await page.getByRole('button', { name: 'Flow' }).click()
  await page.getByRole('button', { name: 'Create landing interactions' }).click()
  await expect(page.getByText('Two flows connected: feature navigation and notification')).toBeVisible()
  await expect(page.getByLabel('Active flow').locator('option')).toHaveCount(2)
  await page.getByLabel('Active flow').selectOption({ label: 'Interactive demo' })
  await expect(page.getByRole('navigation', { name: 'Flow steps' }).getByRole('button', { name: 'Show notification', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Preview' }).click()
  const landing = page.frameLocator('iframe[title="Preview isolata"]')
  await expect(landing.getByRole('heading', { name: 'Build clearer products, faster.' })).toBeVisible()
  await landing.getByRole('button', { name: 'Explore features' }).click()
  await expect(landing.getByRole('heading', { name: 'Everything your team needs to move.' })).toBeVisible()
  await landing.getByRole('button', { name: 'See how it works' }).click()
  await expect(landing.getByRole('status')).toContainText('Interactive demo enabled')
  await page.screenshot({ path: 'artifacts/simple-landing-desktop.png', fullPage: true })
  await landing.getByRole('link', { name: 'Northstar' }).focus()
  await landing.getByRole('link', { name: 'Northstar' }).press('Tab')
  await expect(landing.getByRole('link', { name: 'Features' })).toBeFocused()
  await page.getByRole('button', { name: 'tablet' }).click()
  await expect(page.locator('iframe')).toHaveClass(/preview-tablet/)
  await page.getByRole('button', { name: 'mobile' }).click()
  await expect(page.locator('iframe')).toHaveClass(/preview-mobile/)
  await expect(landing.getByRole('button', { name: 'Open menu' })).toBeVisible()
  await page.screenshot({ path: 'artifacts/simple-landing-mobile.png', fullPage: true })
  await expect(page.getByText('Saved automatically')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: 'Close project and return to the dashboard' }).click()
  await openProject(page, 'Simple Landing Page')
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.frameLocator('iframe[title="Preview isolata"]').getByRole('heading', { name: 'Build clearer products, faster.' })).toBeVisible()
  const landingExportPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export app' }).click()
  await (await landingExportPromise).saveAs('artifacts/simple-landing-page.zip')

  // Scenario 2 — source and all records are created from the UI/preview.
  await page.getByRole('button', { name: 'Close project and return to the dashboard' }).click()
  await page.getByLabel('Project name').fill('Project Management Dashboard')
  await page.getByRole('button', { name: 'Project dashboard KPIs, search, filters, and CRUD' }).click()
  await page.getByRole('button', { name: 'Data' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Projects database')
  await page.getByLabel('Collection', { exact: true }).fill('projects')
  await page.getByRole('button', { name: 'Create IndexedDB source' }).click()
  await expect(page.getByText('IndexedDB source created and schema validated')).toBeVisible()
  await expect(page.getByText(/name:string/)).toBeVisible()
  await page.getByRole('button', { name: 'Flow' }).click()
  await page.getByRole('button', { name: 'Create dashboard flow' }).click()
  await expect(page.getByText('CRUD, loading, search, filter, sort, and KPI flows connected')).toBeVisible()
  await expect(page.getByLabel('Active flow').locator('option')).toHaveCount(7)
  await page.getByLabel('Active flow').selectOption({ label: 'Create project' })
  await expect(page.getByRole('navigation', { name: 'Flow steps' }).getByRole('button', { name: 'Validate fields', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Preview' }).click()
  const dashboard = page.frameLocator('iframe[title="Preview isolata"]')
  await expect(dashboard.getByRole('heading', { name: 'Good morning, Alex' })).toBeVisible()
  await dashboard.getByRole('button', { name: /New project/ }).click()
  await dashboard.getByRole('button', { name: 'Save project' }).click()
  await expect(dashboard.getByRole('dialog').getByRole('alert')).toContainText('Complete all required fields')
  await dashboard.getByRole('button', { name: 'Cancel' }).click()

  const records = [
    { name: 'Atlas Redesign', description: 'Refresh the customer workspace', status: 'In progress', priority: 'High', dueDate: '2026-08-10' },
    { name: 'Mobile Launch', description: 'Prepare the mobile application launch', status: 'Planned', priority: 'High', dueDate: '2026-09-02' },
    { name: 'Analytics v2', description: 'Ship the new reporting experience', status: 'Completed', priority: 'Medium', dueDate: '2026-07-30' },
    { name: 'Billing Migration', description: 'Move accounts to the new billing stack', status: 'On hold', priority: 'High', dueDate: '2026-10-12' },
    { name: 'Design System', description: 'Unify components and interaction patterns', status: 'In progress', priority: 'Medium', dueDate: '2026-08-25' },
  ]
  for (const record of records) await createDashboardRecord(dashboard, record)
  await expect(dashboard.locator('tbody tr')).toHaveCount(5)
  await expect(dashboard.locator('[data-kpi="total"]')).toHaveText('5')
  await expect(dashboard.locator('[data-kpi="progress"]')).toHaveText('2')
  await expect(dashboard.locator('[data-kpi="completed"]')).toHaveText('1')
  await expect(dashboard.locator('[data-kpi="priority"]')).toHaveText('3')
  await page.screenshot({ path: 'artifacts/project-dashboard-desktop.png', fullPage: true })

  await dashboard.getByLabel('Search').fill('Atlas')
  await expect(dashboard.locator('tbody tr')).toHaveCount(1)
  await dashboard.getByLabel('Search').fill('')
  await dashboard.locator('#status-filter').selectOption('Completed')
  await expect(dashboard.locator('tbody tr')).toHaveCount(1)
  await expect(dashboard.getByText('Analytics v2')).toBeVisible()
  await dashboard.locator('#status-filter').selectOption('All statuses')
  await dashboard.getByRole('button', { name: 'Sort: newest' }).click()
  await expect(dashboard.getByRole('button', { name: 'Sort: oldest' })).toBeVisible()

  const atlasRow = dashboard.getByRole('row').filter({ hasText: 'Atlas Redesign' })
  await atlasRow.getByRole('button', { name: 'Edit' }).click()
  await dashboard.locator('#project-modal form').getByLabel('Status').selectOption('Completed')
  await dashboard.locator('#project-modal form').getByRole('button', { name: 'Save project' }).click()
  await expect(atlasRow.getByText('Completed')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  const billingRow = dashboard.getByRole('row').filter({ hasText: 'Billing Migration' })
  await billingRow.getByRole('button', { name: 'Delete' }).click()
  await expect(dashboard.getByText('Billing Migration')).toHaveCount(0)
  await createDashboardRecord(dashboard, { name: 'Team Portal', description: 'Create a shared internal team portal', status: 'Planned', priority: 'Low', dueDate: '2026-11-01' })
  await expect(dashboard.locator('tbody tr')).toHaveCount(5)

  await dashboard.getByLabel('Search').fill('no-result-at-all')
  await expect(dashboard.getByText('No projects match your filters.')).toBeVisible()
  await dashboard.getByLabel('Search').fill('')
  await page.getByRole('button', { name: 'mobile' }).click()
  await dashboard.getByRole('button', { name: 'Open navigation' }).click()
  await expect(dashboard.getByRole('navigation', { name: 'Dashboard' })).toBeVisible()
  await page.screenshot({ path: 'artifacts/project-dashboard-mobile.png', fullPage: true })

  await expect(page.getByText('Saved automatically')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: 'Close project and return to the dashboard' }).click()
  await openProject(page, 'Project Management Dashboard')
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.frameLocator('iframe[title="Preview isolata"]').locator('tbody tr')).toHaveCount(5)
  const dashboardExportPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export app' }).click()
  await (await dashboardExportPromise).saveAs('artifacts/project-management-dashboard.zip')
  expect(errors).toEqual([])
})
