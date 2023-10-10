import isEqual from 'lodash/isEqual'

import { getRichSelectValue } from './configureRichSelect'
import { makeQuery } from './query'
import { rerenderTable } from './utils/table'

const states = new Map<string, string[]>()

export function configureProjectFilters() {
  const { $ } = makeQuery(document.body)
  const projectFilters = $.maybe('#project-filters')
  if (!projectFilters) {
    return
  }
  if (!projectFilters.dataset.allSlugs) {
    throw new Error('No allSlugs found')
  }
  const allProjectSlugs = projectFilters.dataset.allSlugs.split(',')

  const setFilteredSlugs = (slugs: string[]) => {
    if (isEqual(slugs, allProjectSlugs)) {
      delete projectFilters.dataset.filteredSlugs
    } else {
      projectFilters.dataset.filteredSlugs = slugs.join(',')
    }
  }

  const configureCheckbox = (checkbox: HTMLInputElement, stateId: string) => {
    const slugsWhenChecked = checkbox.dataset.slugsWhenChecked?.split(',')
    const slugsWhenUnchecked = checkbox.dataset.slugsWhenUnchecked?.split(',')

    if (!slugsWhenChecked && !slugsWhenUnchecked) {
      throw new Error(`No slugs for ${stateId}`)
    }

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (slugsWhenChecked) {
          states.set(stateId, slugsWhenChecked)
        }
        if (slugsWhenUnchecked) {
          states.delete(stateId)
        }
      } else {
        if (slugsWhenChecked) {
          states.delete(stateId)
        }
        if (slugsWhenUnchecked) {
          states.set(stateId, slugsWhenUnchecked)
        }
      }
      rerenderState()
    })
  }

  const configureRichSelect = (richSelect: HTMLElement, stateId: string) => {
    richSelect.addEventListener('change', () => {
      const selectedValue = getRichSelectValue(richSelect)
      if (selectedValue) {
        const slugs = selectedValue.split(',')
        states.set(stateId, slugs)
      } else {
        states.delete(stateId)
      }
      rerenderState()
      projectFilters.dispatchEvent(new Event('change'))
    })
  }

  const checkboxes = projectFilters.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]',
  )
  const selects = projectFilters.querySelectorAll<HTMLElement>('.RichSelect')

  const rerenderState = () => {
    const stateObj = Object.fromEntries(states)
    const slugsToShow = Object.values(stateObj).reduce<string[]>(
      (acc, curr) => {
        return acc.filter((i) => curr.includes(i))
      },
      [...allProjectSlugs],
    )

    rerenderTables(slugsToShow)
    setFilteredSlugs(slugsToShow)
  }

  checkboxes.forEach((checkbox) => configureCheckbox(checkbox, checkbox.id))
  selects.forEach((select) => configureRichSelect(select, select.id))
}

function rerenderTables(slugsToShow: string[]) {
  const tablesToRerender =
    document.querySelectorAll<HTMLElement>(`[data-role="table"]`)

  tablesToRerender.forEach((table) => rerenderTable(table, slugsToShow))
}

export function getFilteredSlugs(projectFilters: HTMLElement) {
  return projectFilters.dataset.filteredSlugs?.split(',')
}
// const rerenderProjectFilters = (slugs: string[]) => {
//   const selectItems = Array.from(selects).flatMap((select) =>
//     Array.from(select.querySelectorAll<HTMLDivElement>('.RichSelect-Item')),
//   )

//   checkboxes.forEach((checkbox) => {
//     const checkboxSlugs = checkbox.dataset.slugs?.split(',')
//     const slugsUnion = checkboxSlugs?.filter((i) => slugs.includes(i))

//     if (isEmpty(slugsUnion)) {
//       checkbox.disabled = true
//     } else {
//       checkbox.disabled = false
//     }
//   })

//   selectItems.forEach((option) => {
//     if (!option.dataset.value) {
//       throw new Error('No value found')
//     }
//     const itemSlugs = Slugs.parse(JSON.parse(option.dataset.value))
//     const slugsUnion = itemSlugs.filter((i) => slugs.includes(i))

//     if (isEmpty(slugsUnion)) {
//       option.disabled = true
//     } else {
//       option.disabled = false
//     }
//   })
// }
