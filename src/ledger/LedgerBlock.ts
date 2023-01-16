import { Type } from 'class-transformer';
import { LedgerBlockTransaction } from './LedgerBlockTransaction';
import { LedgerBlockEvent } from './LedgerBlockEvent';
import { ObjectUtil } from '@ts-core/common';

export class LedgerBlock {
    // --------------------------------------------------------------------------
    //
    //  Static Methods
    //
    // --------------------------------------------------------------------------

    public static instanceOf(data: any): data is LedgerBlock {
        return ObjectUtil.instanceOf(data, ['number', 'hash', 'id']);
    }

    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    public id: number;
    public hash: string;
    public number: number;
    public rawData: any;
    public eventsCount: number;
    public transactionsCount: number;

    @Type(() => Date)
    public date: Date;

    @Type(() => LedgerBlockEvent)
    public events: Array<LedgerBlockEvent>;

    @Type(() => LedgerBlockTransaction)
    public transactions: Array<LedgerBlockTransaction>;
}
