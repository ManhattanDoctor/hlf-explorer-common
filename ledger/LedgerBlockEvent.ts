import * as _ from 'lodash';
import { Type } from 'class-transformer';
import { ITransportFabricEvent } from '@ts-core/blockchain-fabric/transport/block/ITransportFabricEvent';

export class LedgerBlockEvent implements ITransportFabricEvent {
    // --------------------------------------------------------------------------
    //
    //  Propertes
    //
    // --------------------------------------------------------------------------

    public id: number;

    public name: string;
    public hash: string;
    public channel: string;
    public chaincode: string;
    public blockNumber: number;
    public transactionHash: string;

    @Type(() => Date)
    public createdDate: Date;

    public data?: string;

    public blockId: number;
    public ledgerId: number;
}
