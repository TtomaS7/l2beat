import React from 'react'

import { Checkbox } from '../Checkbox'
import { EthereumLineIcon } from '../icons/chart/EthereumLineIcon'

export function EthereumActivityToggle() {
  return (
    <div data-activity-only>
      <Checkbox
        role="toggle-ethereum-activity"
        id="ethereum-activity"
        className="max-w-[135px] transition-colors duration-200 group-data-[interactivity-disabled]/chart:bg-gray-100 dark:group-data-[interactivity-disabled]/chart:bg-zinc-900 xs:max-w-none"
        checkIconClassName="group-data-[interactivity-disabled]/chart:opacity-0 transition-opacity duration-200 group-data-[interactivity-disabled]/chart:pointer-events-none"
        label={
          <span className="flex items-center gap-2 transition-opacity duration-200 group-data-[interactivity-disabled]/chart:pointer-events-none group-data-[interactivity-disabled]/chart:opacity-0">
            <EthereumLineIcon className="hidden h-1.5 w-2.5 fill-blue-500 sm:inline-block" />
            <span className="hidden md:inline">ETH Mainnet Transactions</span>
            <span className="md:hidden">ETH Txs</span>
          </span>
        }
      />
    </div>
  )
}
