import React from 'react'

import { ScalingLegend } from '../../../components/ScalingLegend'
import { ScalingDetailedTvlFilters } from '../../../components/table/filters/ScalingDetailedTvlFilters'
import { getScalingRowProps } from '../../../components/table/props/getScalingRowProps'
import { getScalingDetailedTvlColumns } from '../../../components/table/props/getScalingTableColumns'
import { RowConfig, TableView } from '../../../components/table/TableView'
import { ScalingDetailedTvlViewEntry } from '../types'

export interface ScalingDetailedTvlViewProps {
  items: ScalingDetailedTvlViewEntry[]
  upcomingEnabled?: boolean
}

export function ScalingDetailedTvlView({ items }: ScalingDetailedTvlViewProps) {
  const rows: RowConfig<ScalingDetailedTvlViewEntry> = {
    getProps: (entry) => getScalingRowProps(entry, 'detailedTvl'),
  }

  return (
    <section className="mt-4 flex flex-col gap-y-2 sm:mt-8">
      <ScalingDetailedTvlFilters items={items} />
      <TableView
        items={items.filter((item) => !item.isArchived && !item.isUpcoming)}
        rows={rows}
        columns={getScalingDetailedTvlColumns()}
        rerenderIndexesOn="#rollups-only-checkbox"
      />
      <ScalingLegend />
    </section>
  )
}
