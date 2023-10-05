import { Layer2, layer2s } from './src'
import { countBy, intersection } from 'lodash'

function contractsResearch(opStacks: Layer2[]) {
  const contracts = opStacks.map((l2) => l2.contracts.addresses)

  // const nameAndDescription = contracts.map((l2) =>
  //   l2.map((c) => [c.name, c.description]),
  // )
  // const names = contracts.map((l2) => l2.map((c) => c.name))
  // const nameAndDescription = contracts.map(l2 => l2.map(c => c.name))

  // const input = nameAndDescription.map(l2 => l2.map(e => JSON.stringify(e)))
  // console.log(intersection(...input))
  //
  // console.log(countBy(names.flatMap(e => e)))
  //
  // console.log(nameAndDescription.map(l2 => l2.filter(e => e[0] === 'L2OutputOracle')))
  // console.log(nameAndDescription.map(l2 => l2.filter(e => e[0] === 'OptimismPortal')))
  // console.log(nameAndDescription.map(l2 => l2.filter(e => e[0] === 'SystemConfig')))
  // console.log(nameAndDescription.map(l2 => l2.filter(e => e[0] === 'L1CrossDomainMessenger')))
  console.log(opStacks)
}

function permissionsResearch(opStacks: Layer2[]) {
  const names = opStacks
    .filter((l2) => l2.permissions && l2.permissions !== 'UnderReview')
    .filter((l2) => l2.permissions.map((p) => p.name === 'ProxyAdmin'))
    .flatMap((l2) => l2.permissions)
    .filter((e) => e.name === 'ProxyAdmin')
    .map((e) => e.description)
  console.log(names)
}

const opStacks = layer2s.filter(
  (l2) =>
    l2.display.provider === 'OP Stack' &&
    !l2.isUpcoming &&
    l2.display.name != 'Kroma',
)

contractsResearch(opStacks)
