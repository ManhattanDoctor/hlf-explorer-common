export const LEDGER_SOCKET_NAMESPACE = `ledger`;

export enum LedgerSocketEvent {
    EXCEPTION = 'EXCEPTION',
    LEDGERS = 'LEDGERS',
    LEDGER_UPDATED = 'LEDGER_UPDATED'
}
