import { describe, expect, it } from 'vitest'
import { makeComponent } from '../src/model'
import { buildBottomNavigation, previewExperienceForPage, renderComponent } from '../src/PreviewFrame'
import { createProject } from '../src/model'

describe('preview component markup', () => {
  it('mantiene il contenuto semantico di un contenitore insieme ai figli', () => {
    const header = makeComponent('header')
    header.props.label = 'Buongiorno, Giulia'
    header.props.description = 'Domenica 19 luglio'

    const html = renderComponent(header, '<button>+ Aggiungi</button>')

    expect(html).toContain('<strong>Buongiorno, Giulia</strong>')
    expect(html).toContain('<p>Domenica 19 luglio</p>')
    expect(html).toContain('<button>+ Aggiungi</button>')
  })

  it('esporta campi data, ora, required e opzioni visuali', () => {
    const input = makeComponent('input')
    input.props.inputType = 'time'
    input.props.required = true
    const select = makeComponent('select')
    select.props.options = 'Bassa|Media|Alta'
    expect(renderComponent(input)).toContain('type="time"')
    expect(renderComponent(input)).toContain(' required')
    expect(renderComponent(select)).toContain('<option>Alta</option>')
  })

  it('rende checkbox e radio come controlli compatti dentro una riga accessibile', () => {
    const checkbox = makeComponent('checkbox')
    checkbox.id = 'notifications'
    checkbox.props.label = 'Notifiche locali'
    const html = renderComponent(checkbox)
    expect(html).toContain('class="choice-control"')
    expect(html).toContain('data-component="notifications"')
    expect(html).toContain('id="preview-notifications-control"')
    expect(html).toContain('<span>Notifiche locali</span>')
  })

  it('prepara grafici a sette barre e calendario con agenda dinamica', () => {
    const chart = makeComponent('chart'), calendar = makeComponent('calendar')
    chart.id = 'trend'; calendar.id = 'agenda'
    expect(renderComponent(chart).match(/<rect/g)).toHaveLength(7)
    expect(renderComponent(chart)).toContain('data-kind="chart"')
    expect(renderComponent(calendar)).toContain('data-kind="calendar"')
    expect(renderComponent(calendar)).toContain('id="preview-agenda-control"')
    expect(renderComponent(calendar)).toContain('<ul aria-live="polite"></ul>')
  })

  it('identifica la sorgente di una lista per aggiornare il binding corretto', () => {
    const list = makeComponent('list')
    list.binding = { sourceId: 'dailyflow-tasks', state: 'data' }
    const html = renderComponent(list)
    expect(html).toContain('data-source="dailyflow-tasks"')
    expect(html).toContain('No items yet. Add your first one.')
  })

  it('crea una navigazione mobile generica dalla configurazione del progetto', () => {
    const project = createProject('App mobile')
    project.pages.push({ id: 'settings', name: 'Impostazioni', path: '/settings', components: [] })
    project.appConfig.mobileBottomNavigation = {
      enabled: true,
      items: [{ label: 'Home & lavoro', path: '/home' }, { label: 'Dati', path: '/data' }],
    }
    const html = buildBottomNavigation(project, '/data')
    expect(html).toContain('data-fe-page="/home"')
    expect(html).toContain('Home &amp; lavoro')
    expect(html).toContain('data-fe-page="/data" aria-current="page"')
    expect(html).toContain('[data-flow-status]')
    expect(html).toContain('class="app-nav-more"')
    expect(html).toContain('data-fe-page="/settings"')
  })

  it('usa il renderer dashboard solo sulla pagina che conserva gli slot del template', () => {
    const dashboard = makeComponent('section'); dashboard.props.slot = 'dashboard-title'
    const quote = makeComponent('form'); quote.props.label = 'Quote form'
    expect(previewExperienceForPage('dashboard', [dashboard])).toBe('dashboard')
    expect(previewExperienceForPage('dashboard', [quote])).toBeUndefined()
  })
})
