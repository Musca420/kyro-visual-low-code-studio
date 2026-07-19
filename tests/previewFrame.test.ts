import { describe, expect, it } from 'vitest'
import { makeComponent } from '../src/model'
import { renderComponent } from '../src/PreviewFrame'

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
})
