import * as _ from 'lodash';
import { Type } from 'class-transformer';
import { ObjectUtil } from '@ts-core/common/util';
import { ITransportEvent } from '@ts-core/common/transport';

export class LedgerBlockEvent<T = any> {
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
    public transactionValidationCode: number;

    @Type(() => Date)
    public createdDate: Date;
    public data?: ITransportEvent<T>;
}
