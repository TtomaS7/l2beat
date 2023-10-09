import cx from 'classnames'
import React, { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

import { InfoIcon } from '../icons'
import { SectionId } from '../project/sectionId'

interface Props<T> {
  items: T[]
  columns: ColumnConfig<T>[]
  rows?: RowConfig<T>
  rerenderIndexesOn?: string
}

export interface ColumnConfig<T> {
  name: ReactNode
  shortName?: ReactNode
  alignRight?: true
  alignCenter?: true
  minimalWidth?: true
  headClassName?: string
  noPaddingRight?: true
  idHref?: SectionId
  getValue: (value: T, index: number) => ReactNode
  tooltip?: string
  highlight?: boolean
}

export interface RowConfig<T> {
  getProps: (
    value: T,
    index: number,
  ) => HTMLAttributes<HTMLTableRowElement> &
    Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>
}

export function TableView<T>({
  items,
  columns,
  rows,
  rerenderIndexesOn,
}: Props<T>) {
  const highlightedColumnClassNames =
    'relative after:content-[""] after:absolute after:left-0 after:top-0 after:h-full after:w-full after:-z-1 after:bg-gray-100 after:dark:bg-[#24202C]'

  return (
    <div
      className={cx(
        'group overflow-x-auto whitespace-pre text-base',
        '-mx-4 w-[calc(100%_+_32px)] px-4 md:-mx-12 md:w-[calc(100%_+_96px)] md:px-12',
      )}
      data-role="table"
      {...(rerenderIndexesOn
        ? { 'data-table-rerender-indexes-on': rerenderIndexesOn }
        : {})}
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-b-gray-200 dark:border-b-gray-800">
            {columns.map((column, i) => {
              const isLastColumn = i === columns.length - 1
              const hasPaddingRight = !column.noPaddingRight && !isLastColumn
              return (
                <th
                  key={i}
                  className={cx(
                    'whitespace-pre py-2 text-sm font-medium uppercase text-gray-500 dark:text-gray-50',
                    column.minimalWidth && 'w-0',
                    hasPaddingRight && 'pr-3 md:pr-4',
                    column.headClassName,
                    column.highlight && highlightedColumnClassNames,
                  )}
                >
                  <div
                    className={cx(
                      'flex flex-row items-center gap-1.5',
                      column.alignRight && 'justify-end',
                      column.alignCenter && 'justify-center',
                    )}
                  >
                    <span className={cx(column.shortName && 'hidden md:block')}>
                      {column.name}
                    </span>
                    {column.shortName && (
                      <span className="md:hidden">{column.shortName}</span>
                    )}
                    {column.tooltip && (
                      <span
                        className="Tooltip -translate-y-px md:translate-y-0"
                        title={column.tooltip}
                      >
                        <InfoIcon className="fill-current md:h-3.5 md:w-3.5" />
                      </span>
                    )}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const {
              href,
              className: rowClassName,
              ...rest
            } = rows?.getProps(item, i) ?? {}
            return (
              <tr
                key={i}
                {...rest}
                className={cx(
                  'group cursor-pointer border-b border-b-gray-200 dark:border-b-gray-800',
                  'hover:bg-black/[0.1] hover:shadow-sm dark:hover:bg-white/[0.1]',
                  rowClassName,
                )}
              >
                {columns.map((column, j) => {
                  const isLastColumn = j === columns.length - 1
                  const hasPaddingRight =
                    !column.noPaddingRight && !isLastColumn
                  const idHref =
                    column.idHref && href ? `${href}#${column.idHref}` : href

                  const childClassName = cx(
                    'h-full w-full items-center',
                    column.alignRight && 'justify-end',
                    column.alignCenter && 'justify-center',
                    hasPaddingRight && 'pr-3 md:pr-4',
                  )

                  return (
                    <td
                      key={j}
                      className={cx(
                        'h-9 md:h-14',
                        column.minimalWidth && 'w-0',
                        column.highlight && highlightedColumnClassNames,
                      )}
                    >
                      <a href={idHref} className={cx(childClassName, 'flex')}>
                        {column.getValue(item, i)}
                      </a>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="hidden flex-col items-center justify-center gap-4 bg-blue-700 bg-opacity-20 pt-10 pb-10 group-data-[state=empty]:flex">
        <span className="text-2xl font-semibold">No results</span>
        <span>There are no results meeting the criteria</span>
      </div>
    </div>
  )
}
