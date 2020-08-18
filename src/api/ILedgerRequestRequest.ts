import { ITransportCommand, ITransportCommandOptions } from '@ts-core/common/transport';

export interface ILedgerRequestRequest<U = any> {
    request: ITransportCommand<U>;
    options: ITransportCommandOptions;
    isAsync: boolean;
    ledgerId: number;
}
