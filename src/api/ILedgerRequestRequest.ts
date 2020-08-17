import { ITransportCommandFabric } from '@ts-core/blockchain-fabric/transport/TransportFabric';
import { ITransportFabricCommandOptions } from '@ts-core/blockchain-fabric/transport/ITransportFabricCommandOptions';

export interface ILedgerRequestRequest<U = any> {
    request: ITransportCommandFabric<U>;
    options: ITransportFabricCommandOptions;
    isAsync: boolean;
    ledgerId: number;
}
