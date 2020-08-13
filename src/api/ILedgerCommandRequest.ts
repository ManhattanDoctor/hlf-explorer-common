import { ITransportCommandFabric } from '@ts-core/blockchain-fabric/transport/TransportFabric';
import { ITransportFabricCommandOptions } from '@ts-core/blockchain-fabric/transport/ITransportFabricCommandOptions';

export interface ILedgerCommandRequest<U = any> {
    command: ITransportCommandFabric<U>;
    options: ITransportFabricCommandOptions;
    isAsync: boolean;
    ledgerId: number;
}
