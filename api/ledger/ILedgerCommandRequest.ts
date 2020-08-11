import { ITransportCommandFabric, ITransportFabricCommandOptions } from '@ts-core/blockchain-fabric/transport';

export interface ILedgerCommandRequest<U = any> {
    command: ITransportCommandFabric<U>;
    options: ITransportFabricCommandOptions;
    isAsync: boolean;
    ledgerId: number;
}