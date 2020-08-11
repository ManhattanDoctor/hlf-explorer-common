import { Block } from 'fabric-client';
import { Type } from 'class-transformer';
import { LedgerBlockTransaction } from './LedgerBlockTransaction';
import { LedgerBlockEvent } from './LedgerBlockEvent';
import { ObjectUtil } from '@ts-core/common/util';

export class LedgerBlock {
    // --------------------------------------------------------------------------
    //
    //  Static Methods
    //
    // --------------------------------------------------------------------------

    public static instanceOf(data: any): data is LedgerBlock {
        return ObjectUtil.instanceOf(data, ['number', 'hash', 'rawData']);
    }

    // --------------------------------------------------------------------------
    //
    //  Propertes
    //
    // --------------------------------------------------------------------------

    public id: number;
    public uid: string;

    public hash: string;
    public number: number;
    public rawData: Block;

    @Type(() => Date)
    public createdDate: Date;

    @Type(() => LedgerBlockEvent)
    public events: Array<LedgerBlockEvent>;

    @Type(() => LedgerBlockTransaction)
    public transactions: Array<LedgerBlockTransaction>;
}
