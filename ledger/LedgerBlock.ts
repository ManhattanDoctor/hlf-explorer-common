import { Block } from 'fabric-client';
import { Exclude, Type } from 'class-transformer';
import { TransformUtil } from '@ts-core/common/util';
import { LedgerBlockTransaction } from './LedgerBlockTransaction';

export class LedgerBlock {
    // --------------------------------------------------------------------------
    //
    //  Static Methods
    //
    // --------------------------------------------------------------------------

    public static fromClass(item: LedgerBlock): any {
        return TransformUtil.fromClass(item);
    }
    public static toClass(item: any): LedgerBlock {
        return TransformUtil.toClass(LedgerBlock, item);
    }

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

    @Type(() => LedgerBlockTransaction)
    public transactions: Array<LedgerBlockTransaction>;

    public ledgerId: number;
}
