import { ITransportCommand, ITransportCommandOptions } from '@ts-core/common';

export interface ILedgerRequestRequest<U = any> {
    request: ITransportCommand<U>;
    options?: ITransportCommandOptions;
    
    isAsync: boolean;
    ledgerName: string;
}
