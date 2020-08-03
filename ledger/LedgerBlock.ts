import { Block } from 'fabric-client';
import { Type } from 'class-transformer';
import { LedgerBlockTransaction } from './LedgerBlockTransaction';
import { LedgerBlockEvent } from './LedgerBlockEvent';

export class LedgerBlock {
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
