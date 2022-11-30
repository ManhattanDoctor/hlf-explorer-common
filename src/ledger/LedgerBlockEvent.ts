import * as _ from 'lodash';
import { Type } from 'class-transformer';
import { ObjectUtil } from '@ts-core/common';
import { ITransportEvent } from '@ts-core/common';

export class LedgerBlockEvent<T = any> implements ITransportEvent<T> {
    // --------------------------------------------------------------------------
    //
    //  Static Methods
    //
    // --------------------------------------------------------------------------

    public static instanceOf(data: any): data is LedgerBlockEvent {
        return ObjectUtil.instanceOf(data, ['name', 'requestId']);
    }

    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    public id: number;
    public uid: string;

    public name: string;
    public channel: string;
    public requestId: string;
    public chaincode: string;
    public blockNumber: number;
    public transactionHash: string;
    public transactionValidationCode: number;

    @Type(() => Date)
    public createdDate: Date;
    public data?: T;
}
