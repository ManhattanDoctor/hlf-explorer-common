import { Block } from 'fabric-client';
import { Exclude, Type } from 'class-transformer';
import { LedgerBlockTransaction } from './LedgerBlockTransaction';
import { LedgerBlockEvent } from './LedgerBlockEvent';

export class LedgerBlock {
    // --------------------------------------------------------------------------
    //
    //  Propertes
    //
    // --------------------------------------------------------------------------

    @Exclude()
    public id: number;
    public hash: string;
    public number: number;
    public rawData: Block;

    @Type(() => Date)
    public createdDate: Date;

    @Type(() => LedgerBlockEvent)
    public events: Array<LedgerBlockEvent>;

    @Type(() => LedgerBlockTransaction)
    public transactions: Array<LedgerBlockTransaction>;

    public ledgerId: number;
}
