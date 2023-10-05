export type OpStackContractName =
  | 'L2OutputOracle'
  | 'OptimismPortal'
  | 'SystemConfig'
  | 'L1CrossDomainMessenger'

export interface OPStackContractTemplate {
  name: OpStackContractName
  coreDescription: string
}

export const OP_STACK_CONTRACT_DESCRIPTION: OPStackContractTemplate[] = [
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
