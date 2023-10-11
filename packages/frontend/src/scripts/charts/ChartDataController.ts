import range from 'lodash/range'

import {
  ActivityResponse,
  AggregateDetailedTvlResponse,
  ChartType,
  TokenInfo,
  TokenTvlResponse,
} from './types'
import { ChartViewController } from './view-controller/ChartViewController'
import { ChartData } from './view-controller/types'

export class ChartDataController {
  private chartType?: ChartType
  private abortController?: AbortController
  private readonly cache = new Map<string, unknown>()

  constructor(private readonly chartViewController: ChartViewController) {}

  setChartType(chartType: ChartType) {
    this.chartType = chartType
    this.refetch()
  }

  showEmptyChart() {
    this.abortController?.abort()
    this.abortController = new AbortController()
    this.chartViewController.setChartState('empty')
  }

  private refetch() {
    if (!this.chartType) {
      return
    }
    this.abortController?.abort()
    this.abortController = new AbortController()

    this.chartViewController.showLoader()
    const chartType = this.chartType
    const url = getChartUrl(chartType)

    if (Array.isArray(url)) {
      const responses = url.map((url) =>
        fetch(url, { signal: this.abortController?.signal }),
      )
      void Promise.all(responses)
        .then((responses) => Promise.all(responses.map((res) => res.json())))
        .then((data: unknown[]) => {
          const parsedData = this.parseDataArray(chartType, data)
          this.chartViewController.configure({ data: parsedData })
        })
        .finally(() => this.chartViewController.hideLoader())
      return
    }

    if (this.cache.has(url)) {
      this.parseAndConfigure(chartType, this.cache.get(url))
      this.chartViewController.hideLoader()
      return
    }

    void fetch(url, { signal: this.abortController.signal })
      .then((res) => res.json())
      .then((data: unknown) => {
        this.parseAndConfigure(chartType, data)
        this.cache.set(url, data)
      })
      .finally(() => this.chartViewController.hideLoader())
  }

  private parseAndConfigure(chartType: ChartType, data: unknown) {
    const parsedData = this.parseData(chartType, data)
    this.chartViewController.configure({ data: parsedData })
  }

  private parseDataArray(chartType: ChartType, data: unknown[]): ChartData {
    switch (chartType.type) {
      case 'layer2-tvl':
        return {
          type: 'tvl',
          values: groupAndSumTvlData(
            data.map((data) => AggregateDetailedTvlResponse.parse(data)),
          ),
        }
      case 'layer2-detailed-tvl':
        return {
          type: 'detailed-tvl',
          values: groupAndSumTvlData(
            data.map((data) => AggregateDetailedTvlResponse.parse(data)),
          ),
        }

      case 'layer2-activity': {
        return {
          type: 'activity',
          values: groupAndSumActivityData(
            data.map((data) => ActivityResponse.parse(data)),
          ),
          isAggregate: false,
        }
      }
      default:
        throw new Error(`Unhandled chart type: ${chartType.type}`)
    }
  }

  private parseData(chartType: ChartType, data: unknown): ChartData {
    switch (chartType.type) {
      case 'layer2-tvl':
      case 'bridges-tvl':
      case 'project-tvl':
      case 'storybook-fake-tvl':
        return {
          type: 'tvl',
          values: AggregateDetailedTvlResponse.parse(data),
        }
      case 'layer2-detailed-tvl':
      case 'project-detailed-tvl':
        return {
          type: 'detailed-tvl',
          values: AggregateDetailedTvlResponse.parse(data),
        }
      case 'project-token-tvl':
        return {
          type: 'token-tvl',
          tokenSymbol: chartType.info.symbol,
          tokenType: chartType.info.type,
          values: TokenTvlResponse.parse(data),
        }

      case 'layer2-activity':
      case 'project-activity':
      case 'storybook-fake-activity':
        return {
          type: 'activity',
          isAggregate: chartType.type !== 'project-activity',
          values: ActivityResponse.parse(data),
        }
    }
  }
}

export function getChartUrl(chartType: ChartType) {
  switch (chartType.type) {
    case 'layer2-tvl':
    case 'layer2-detailed-tvl':
      return chartType.filteredSlugs
        ? chartType.filteredSlugs.map((slug) => `/api/tvl/${slug}.json`)
        : '/api/tvl/scaling.json'
    case 'layer2-activity':
      return chartType.filteredSlugs
        ? chartType.filteredSlugs.map((slug) => `/api/activity/${slug}.json`)
        : '/api/activity/combined.json'
    case 'bridges-tvl':
      return chartType.includeCanonical
        ? '/api/tvl/combined.json'
        : '/api/tvl/bridges.json'
    case 'project-tvl':
    case 'project-detailed-tvl':
      return `/api/tvl/${chartType.slug}.json`
    case 'project-token-tvl':
      return getTokenTvlUrl(chartType.info)
    case 'project-activity':
      return `/api/activity/${chartType.slug}.json`
    case 'storybook-fake-tvl':
      return '/fake-tvl.json'
    case 'storybook-fake-activity':
      return '/fake-activity.json'
  }
}

export function getTokenTvlUrl(info: TokenInfo) {
  const chainId = 'chainId' in info ? info.chainId : 1
  const type = info.type === 'regular' ? 'CBV' : info.type
  return `/api/projects/${info.projectId}/tvl/chains/${chainId}/assets/${info.assetId}/types/${type}`
}

function groupAndSumTvlData(
  dataArray: AggregateDetailedTvlResponse[],
): AggregateDetailedTvlResponse {
  return {
    hourly: {
      data: groupTvlDataByTimestamp(dataArray, 'hourly'),
      types: dataArray[0].hourly.types,
    },
    sixHourly: {
      data: groupTvlDataByTimestamp(dataArray, 'sixHourly'),
      types: dataArray[0].sixHourly.types,
    },
    daily: {
      data: groupTvlDataByTimestamp(dataArray, 'daily'),
      types: dataArray[0].daily.types,
    },
  }
}

function groupAndSumActivityData(
  dataArray: ActivityResponse[],
): ActivityResponse {
  return {
    daily: {
      data: groupActivityDataByTimestamp(dataArray, 'daily'),
      types: dataArray[0].daily.types,
    },
  }
}

function groupTvlDataByTimestamp(
  responses: AggregateDetailedTvlResponse[],
  key: keyof AggregateDetailedTvlResponse,
) {
  const groupedByTimestamp = new Map<
    number,
    AggregateDetailedTvlResponse['daily']['data'][0]
  >()

  for (const response of responses) {
    const data = response[key].data

    for (const values of data) {
      const timestamp = values[0]
      const groupedDataArray = groupedByTimestamp.get(timestamp)

      if (!groupedDataArray) {
        groupedByTimestamp.set(timestamp, values)
        continue
      }

      for (const index of range(1, values.length)) {
        groupedDataArray[index] += values[index]
      }
      groupedByTimestamp.set(timestamp, groupedDataArray)
    }
  }

  return Array.from(groupedByTimestamp.values()).sort((a, b) => a[0] - b[0])
}

function groupActivityDataByTimestamp(
  responses: ActivityResponse[],
  key: keyof ActivityResponse,
) {
  const projectTpsIndex = 1
  const groupedByTimestamp = new Map<
    number,
    ActivityResponse['daily']['data'][0]
  >()

  for (const response of responses) {
    const data = response[key].data

    for (const values of data) {
      const timestamp = values[0]
      const groupedDataArray = groupedByTimestamp.get(timestamp)

      if (!groupedDataArray) {
        groupedByTimestamp.set(timestamp, values)
        continue
      }

      groupedDataArray[projectTpsIndex] += values[projectTpsIndex]
      groupedByTimestamp.set(timestamp, groupedDataArray)
    }
  }
  return Array.from(groupedByTimestamp.values()).sort((a, b) => a[0] - b[0])
}
