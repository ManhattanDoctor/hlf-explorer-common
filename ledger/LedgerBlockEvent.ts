import * as _ from 'lodash';
import { Type } from 'class-transformer';
import { ITransportFabricEvent } from '@ts-core/blockchain-fabric/transport/block/ITransportFabricEvent';
import { ObjectUtil } from '@ts-core/common/util';

export class LedgerBlockEvent<T = any> implements ITransportFabricEvent<T> {
    // --------------------------------------------------------------------------
    //
    //  Static Methods
    //
    // --------------------------------------------------------------------------

    public static instanceOf(data: any): data is LedgerBlockEvent {
        return ObjectUtil.instanceOf(data, ['name', 'transactionHash']);
    }

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
