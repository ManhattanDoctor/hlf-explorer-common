import { LedgerBlock, LedgerBlockTransaction } from '../../ledger';

export interface ILedgerSearchResponse {
    value: LedgerBlock | LedgerBlockTransaction;
}
