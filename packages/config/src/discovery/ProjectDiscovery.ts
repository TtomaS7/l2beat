import type {
  ContractParameters,
  ContractValue,
  DiscoveryOutput,
} from '@l2beat/discovery-types'
import {
  assert,
  EthereumAddress,
  gatherAddressesFromUpgradeability,
  UnixTime,
} from '@l2beat/shared-pure'
import { utils } from 'ethers'
import fs from 'fs'
import { isArray, isString } from 'lodash'
import path from 'path'

import {
  ProjectEscrow,
  ProjectPermission,
  ProjectPermissionedAccount,
  ProjectReference,
} from '../common'
import {
    calculateInversion
} from '@l2beat/discovery'
import {
  ProjectContractSingleAddress,
  ProjectUpgradeability,
} from '../common/ProjectContracts'
import { delayDescriptionFromSeconds } from '../utils/delayDescription'
import { InvertedAddresses } from '@l2beat/discovery/dist/inversion/runInversion'

type AllKeys<T> = T extends T ? keyof T : never

type MergedUnion<T extends object> = {
  [K in AllKeys<T>]: PickType<T, K>
}

type PickType<T, K extends AllKeys<T>> = T extends { [k in K]?: T[K] }
  ? T[K]
  : undefined

export type Filesystem = typeof filesystem
const filesystem = {
  readFileSync: (path: string) => {
    return fs.readFileSync(path, 'utf-8')
  },
}

export class ProjectDiscovery {
  private readonly discovery: DiscoveryOutput
  constructor(
    public readonly projectName: string,
    private readonly fs: Filesystem = filesystem,
  ) {
    this.discovery = this.getDiscoveryJson(projectName)
  }

  private getDiscoveryJson(project: string): DiscoveryOutput {
    const discoveryFile = this.fs.readFileSync(
      path.resolve(`../backend/discovery/${project}/ethereum/discovered.json`),
    )

    return JSON.parse(discoveryFile) as DiscoveryOutput
  }

  getContractDetails(
    identifier: string,
    descriptionOrOptions?: string | Partial<ProjectContractSingleAddress>,
  ): ProjectContractSingleAddress {
    const contract = this.getContract(identifier)
    if (typeof descriptionOrOptions === 'string') {
      descriptionOrOptions = { description: descriptionOrOptions }
    } else if (descriptionOrOptions?.pausable !== undefined) {
      const descriptions = [
        descriptionOrOptions.description,
        `The contract is pausable by ${descriptionOrOptions.pausable.pausableBy.join(
          ', ',
        )}.`,
      ]
      if (descriptionOrOptions.pausable.paused) {
        descriptions.push('The contract is currently paused.')
      }
      descriptionOrOptions.description = descriptions.filter(isString).join(' ')
    }
    return {
      name: contract.name,
      address: contract.address,
      upgradeability: contract.upgradeability,
      ...descriptionOrOptions,
    }
  }

  getEscrowDetails({
    address,
    name,
    description,
    sinceTimestamp,
    tokens,
    upgradableBy,
    upgradeDelay,
  }: {
    address: EthereumAddress
    name?: string
    description?: string
    sinceTimestamp?: UnixTime
    tokens: string[] | '*'
    upgradableBy?: string[]
    upgradeDelay?: string
  }): ProjectEscrow {
    const contract = this.getContractByAddress(address.toString())
    const timestamp = sinceTimestamp?.toNumber() ?? contract.sinceTimestamp
    assert(
      timestamp,
      'No timestamp was found for an escrow. Possible solutions:\n1. Run discovery for that address to capture the sinceTimestamp.\n2. Provide your own sinceTimestamp that will override the value from discovery.',
    )

    return {
      address,
      newVersion: true,
      sinceTimestamp: new UnixTime(timestamp),
      tokens,
      contract: {
        name: name ?? contract.name,
        description,
        upgradeability: contract.upgradeability,
        upgradableBy,
        upgradeDelay,
      },
    }
  }

  getInversion(): InvertedAddresses {
      return calculateInversion(this.discovery)
  }

  getOpStackPermissions(): ProjectPermission[] {
      const PERMISSION_TEMPLATES = [
          {
              name: 'ProxyAdmin',
              source: { contract: 'AddressManager', value: 'owner', },
              description: "Admin of the {0} proxies. It's controlled by the {1}.",
              descriptionArgSource: [[{name: "admin"}, {name: "addressManager", reverse: true}], [{name: "owner", reverse: true}]]
          },
          {
              name: 'Sequencer',
              source: { contract: 'SystemConfig', value: 'batcherHash', },
              description: 'Central actor allowed to commit L2 transactions to L1.',
              descriptionArgSource: []
          },
          {
              name: 'Proposer',
              source: {contract: 'L2OutputOracle', value: 'PROPOSER'},
              description: 'Central actor allowed to post new L2 state roots to L1.',
              descriptionArgSource: []
          },
      ]

      const inversion = this.getInversion()
      function getDescription(p: typeof PERMISSION_TEMPLATES[0]) {
          const args = []

          for(const argSources of p.descriptionArgSource) {
              const arg = []
              for(const source of argSources) {
                  if(source.reverse) {
                      for(const entry of inversion.values()) {
                          const controls = entry.roles.find(r => r.name === source.name && r.atName === p.name)
                          if(controls) {
                              arg.push(entry.name ?? entry.address)
                          }
                      }
                  } else {
                      for(const entry of inversion.values()) {
                          if(p.name === entry.name) {
                              arg.push(entry.roles.filter(r => r.name === source.name).map(r => r.atName).join(", "))
                          }
                      }
                  }
              }
              args.push(arg.join(", "))
          }

          return stringFormat(p.description, ...args)
      }


      return PERMISSION_TEMPLATES.map(p => ({
          name: p.name,
          accounts: [
              this.getPermissionedAccount(p.source.contract, p.source.value),
          ],
          description: getDescription(p),
      }))
  }

  getMultisigPermission(
    identifier: string,
    description: string,
    references?: ProjectReference[],
  ): ProjectPermission[] {
    const contract = this.getContract(identifier)
    assert(
      contract.upgradeability.type === 'gnosis safe',
      `Contract ${contract.name} is not a Gnosis Safe (${this.projectName})`,
    )

    return [
      {
        name: identifier,
        description: `${description} This is a Gnosis Safe with ${this.getMultisigStats(
          identifier,
        )} threshold.`,
        accounts: [
          {
            address: contract.address,
            type: 'MultiSig',
          },
        ],
      },
      {
        name: `${identifier} participants`,
        description: `Those are the participants of the ${identifier}.`,
        accounts: this.getPermissionedAccounts(identifier, 'getOwners'),
        references,
      },
    ]
  }

  getContract(identifier: string): ContractParameters {
    try {
      identifier = utils.getAddress(identifier)
    } catch {
      return this.getContractByName(identifier)
    }
    return this.getContractByAddress(identifier)
  }

  getContractValue<T extends ContractValue>(
    contractIdentifier: string,
    key: string,
  ): T {
    const contract = this.getContract(contractIdentifier)
    const result = contract.values?.[key] as T | undefined
    assert(
      isNonNullable(result),
      `Value of key ${key} does not exist in ${contractIdentifier} contract (${this.projectName})`,
    )

    return result
  }

  getAddressFromValue(
    contractIdentifier: string,
    key: string,
  ): EthereumAddress {
    const address = this.getContractValue(contractIdentifier, key)

    assert(
      isString(address) && EthereumAddress.check(address),
      `Value of ${key} must be an Ethereum address`,
    )

    return EthereumAddress(address)
  }

  formatPermissionedAccount(
    account: ContractValue | EthereumAddress,
  ): ProjectPermissionedAccount {
    assert(
      isString(account) && EthereumAddress.check(account),
      `Values must be Ethereum addresses`,
    )
    const address = EthereumAddress(account)
    const isEOA = this.discovery.eoas.includes(address)
    const contract = this.discovery.contracts.find(
      (contract) => contract.address === address,
    )
    const isMultisig = contract?.upgradeability.type === 'gnosis safe'

    const type = isEOA ? 'EOA' : isMultisig ? 'MultiSig' : 'Contract'

    return { address: address, type }
  }

  getPermissionedAccount(
    contractIdentifier: string,
    key: string,
  ): ProjectPermissionedAccount {
    const value = this.getContractValue(contractIdentifier, key)
    return this.formatPermissionedAccount(value)
  }

  getPermissionedAccounts(
    contractIdentifier: string,
    key: string,
    index?: number,
  ): ProjectPermissionedAccount[] {
    let value = this.getContractValue(contractIdentifier, key)
    assert(isArray(value), `Value of ${key} must be an array`)

    if (index !== undefined) {
      value = (value as ContractValue[])[index]
      assert(isArray(value), `Value of ${key}[${index}] must be an array`)
    }

    return value.map(this.formatPermissionedAccount.bind(this))
  }

  getContractFromValue(
    contractIdentifier: string,
    key: string,
    descriptionOrOptions?: string | Partial<ProjectContractSingleAddress>,
  ): ProjectContractSingleAddress {
    const address = this.getContractValue(contractIdentifier, key)
    assert(
      isString(address) && EthereumAddress.check(address),
      `Value of ${key} must be an Ethereum address`,
    )
    const contract = this.getContract(address)
    if (typeof descriptionOrOptions === 'string') {
      descriptionOrOptions = { description: descriptionOrOptions }
    }

    return {
      address: contract.address,
      name: contract.name,
      upgradeability: contract.upgradeability,
      ...descriptionOrOptions,
    }
  }

  getContractFromUpgradeability<
    K extends keyof MergedUnion<ProjectUpgradeability>,
  >(contractIdentifier: string, key: K): ContractParameters {
    const address = this.getContractUpgradeabilityParam(contractIdentifier, key)
    assert(
      isString(address) && EthereumAddress.check(address),
      `Value of ${key} must be an Ethereum address`,
    )
    const contract = this.getContract(address)

    return {
      address: contract.address,
      name: contract.name,
      upgradeability: contract.upgradeability,
    }
  }

  getDelayStringFromUpgradeability<
    K extends keyof MergedUnion<ProjectUpgradeability>,
  >(contractIdentifier: string, key: K): string {
    const delay = this.getContractUpgradeabilityParam(contractIdentifier, key)
    assert(typeof delay === 'number', `Value of ${key} must be a number`)
    return delayDescriptionFromSeconds(delay)
  }

  contractAsPermissioned(
    contract: ContractParameters,
    description: string,
  ): ProjectPermission {
    return {
      name: contract.name,
      accounts: [
        {
          address: contract.address,
          type: 'Contract',
        },
      ],
      description,
    }
  }

  getMultisigStats(contractIdentifier: string) {
    const threshold = this.getContractValue<number>(
      contractIdentifier,
      'getThreshold',
    )
    const size = this.getContractValue<string[]>(
      contractIdentifier,
      'getOwners',
    ).length
    return `${threshold} / ${size}`
  }

  getConstructorArg<T extends ContractValue>(
    contractIdentifier: string,
    index: number,
  ): T {
    return this.getContractValue<T[]>(contractIdentifier, `constructorArgs`)[
      index
    ]
  }

  getContractUpgradeabilityParam<
    K extends keyof MergedUnion<ProjectUpgradeability>,
    T extends MergedUnion<ProjectUpgradeability>[K],
  >(contractIdentifier: string, key: K): NonNullable<T> {
    const contract = this.getContract(contractIdentifier)
    //@ts-expect-error only 'type' is allowed here, but many more are possible with our error handling
    const result = contract.upgradeability[key] as T | undefined
    assert(
      isNonNullable(result),
      `Upgradeability param of key ${key} does not exist in ${contract.name} contract (${this.projectName})`,
    )

    return result
  }

  getAllContractAddresses(): EthereumAddress[] {
    return this.discovery.contracts.flatMap((contract) => [
      contract.address,
      ...gatherAddressesFromUpgradeability(contract.upgradeability),
    ])
  }

  getContractByAddress(address: string): ContractParameters {
    const contract = this.discovery.contracts.find(
      (contract) => contract.address === EthereumAddress(address),
    )

    assert(
      contract,
      `No contract of ${address} address found (${this.projectName})`,
    )

    return contract
  }


  getOpStackContractDetails(
    upgradesProxy: Partial<ProjectContractSingleAddress>,
    overrides?: Record<string, string>,
  ): ProjectContractSingleAddress[] {
    const CONTRACT_DESCRIPTION = [
      {
        name: 'L2OutputOracle',
        coreDescription:
          'The {0} contract contains a list of proposed state roots which Proposers assert to be a result of block execution. Currently only the PROPOSER address can submit new state roots.',
      },
      {
        name: 'OptimismPortal',
        coreDescription:
          'The {0} contract is the main entry point to deposit funds from L1 to L2. It also allows to prove and finalize withdrawals.',
      },
      {
        name: 'SystemConfig',
        coreDescription:
          'It contains configuration parameters such as the Sequencer address, the L2 gas limit and the unsafe block signer address.',
      },
      {
        name: 'L1CrossDomainMessenger',
        coreDescription:
          "The {0} (L1xDM) contract sends messages from L1 to L2, and relays messages from L2 onto L1. In the event that a message sent from L1 to L2 is rejected for exceeding the L2 epoch gas limit, it can be resubmitted via this contract's replay function.",
      },
    ]

    return CONTRACT_DESCRIPTION.map((d) =>
      this.getContractDetails(overrides?.[d.name] ?? d.name, {
        description: stringFormat(d.coreDescription, overrides?.[d.name] ?? d.name),
        ...upgradesProxy,
      }),
    )
  }

  private getContractByName(name: string): ContractParameters {
    const contracts = this.discovery.contracts.filter(
      (contract) => contract.name === name,
    )
    assert(
      !(contracts.length > 1),
      `Found more than one contracts of ${name} name (${this.projectName})`,
    )
    assert(
      contracts.length === 1,
      `Found no contract of ${name} name (${this.projectName})`,
    )

    return contracts[0]
  }
}

function isNonNullable<T>(
  value: T | undefined | null,
): value is NonNullable<T> {
  return value !== null && value !== undefined
}

type OP_STACK_CONTRACT_NAME = "L2OutputOracle" | "OptimismPortal" | "SystemConfig" | "L1CrossDomainMessenger"

export function stringFormat(str: string, ...val: string[]) {
  for (let index = 0; index < val.length; index++) {
    str = str.replaceAll(`{${index}}`, val[index])
  }
  return str
}
