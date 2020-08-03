import * as _ from 'lodash';
import { Type } from 'class-transformer';
import { ITransportFabricEvent } from '@ts-core/blockchain-fabric/transport/block/ITransportFabricEvent';

export class LedgerBlockEvent<T = any> implements ITransportFabricEvent<T> {
    // --------------------------------------------------------------------------
    //
    //  Propertes
    //
    // --------------------------------------------------------------------------

    public id: number;
    public uid: string;

    public name: string;
    public channel: string;
    public chaincode: string;
    public blockNumber: number;
    public transactionHash: string;

    @Type(() => Date)
    public createdDate: Date;

    public data?: T;
}
