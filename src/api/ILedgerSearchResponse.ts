import { LedgerBlock, LedgerBlockTransaction, LedgerBlockEvent } from '../ledger';

export interface ILedgerSearchResponse {
    value: LedgerBlock | LedgerBlockTransaction | LedgerBlockEvent;
}
