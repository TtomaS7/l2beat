import { makeQuery } from './query'

type TableState = 'empty' | null

export function configureTables() {
  const { $$ } = makeQuery(document.body)
  const tablesToRerenderOnLoad = $$('[data-role=table][data-rerender-on-load]')
  tablesToRerenderOnLoad.forEach((table) => rerenderTable(table))
}

export function rerenderTable(table: HTMLElement, slugsToShow?: string[]) {
  const parentElement = table.parentElement
  const isInsideTabs = parentElement?.classList.contains('TabsContent')

  const visibleRowsLength = rerenderRows(table, slugsToShow)

  if (parentElement && isInsideTabs) {
    rerenderTabCountBadge(parentElement.id, visibleRowsLength)
  }

  setTableState(table, visibleRowsLength === 0 ? 'empty' : null)
}

function rerenderRows(table: HTMLElement, slugs?: string[]) {
  const { $$ } = makeQuery(table)
  const rows = $$('tbody tr')

  if (slugs) {
    rows.forEach((row) => {
      const slug = row.dataset.slug
      if (!slug) {
        throw new Error('No slug found')
      }
      if (row.dataset.nonFilterable) {
        return
      }

      if (slugs.includes(slug)) {
        row.classList.remove('hidden')
      } else {
        row.classList.add('hidden')
      }
    })
  }

  const visibleRows = rows.filter((r) => !r.classList.contains('hidden'))
  return rerenderIndexes(visibleRows)
}

function rerenderTabCountBadge(tabId: string, visibleRowsLength: number) {
  const tabBadgeCount = document.querySelector(
    `.TabsItem#${tabId} .TabsItem-CountBadge`,
  )
  if (!tabBadgeCount) {
    throw new Error('No tabBadgeCount found')
  }
  tabBadgeCount.innerHTML = `${visibleRowsLength}`
}

function rerenderIndexes(visibleRows: HTMLElement[]) {
  visibleRows.forEach((r, index) => {
    const indexCell = r.querySelector('[data-role="index-cell"]')
    if (!indexCell) {
      console.error('Programming error: no index cell found', r)
      return
    }
    indexCell.innerHTML = `${index + 1}`
  })

  return visibleRows.length
}

function setTableState(table: HTMLElement, state: TableState) {
  if (state === null) {
    delete table.dataset.state
    return
  }
  table.dataset.state = state
}
