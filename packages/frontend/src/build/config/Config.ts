import { Bridge, Layer2, Milestone, TokenInfo } from '@l2beat/config'

export interface Config {
  links: {
    twitter: string
    discord: string
    github: string
    linkedin: string
    youTube: string
    medium: string
    forum: string
  }
  features: {
    l2assets: boolean
    activity: boolean
    banner: boolean
    gitcoinOption: boolean
    milestones: boolean
    hiring: boolean
    stages: boolean
    buildAllProjectPages: boolean
    upcomingRollups: boolean
  }
  backend: {
    apiUrl: string
    skipCache: boolean
  }
  layer2s: Layer2[]
  bridges: Bridge[]
  milestones: Milestone[]
  tokens: TokenInfo[]
}
