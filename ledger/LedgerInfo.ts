import { LedgerBlock } from './LedgerBlock';
import { Exclude, Transform } from 'class-transformer';
import { TransformUtil } from '@ts-core/common/util';
import { LedgerBlocksLast } from './LedgerBlocksLast';
import { LedgerBlockTransactionsLast } from './LedgerBlockTransactionsLast';
import * as _ from 'lodash';
import { LedgerBlockEventsLast } from './LedgerBlockEventsLast';

export class LedgerInfo {
    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public static toClass(value: any): LedgerInfo {
        let item = TransformUtil.toClass(LedgerInfo, value);
        item.blockLast = item.blocksLast.getLast();
        item.eventsLast = new LedgerBlockEventsLast(_.flatten(item.blocksLast.collection.map(item => item.events)));
        item.transactionsLast = new LedgerBlockTransactionsLast(_.flatten(item.blocksLast.collection.map(item => item.transactions)));
        return item;
    }

    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    public id: number;
    public name: string;

    @Transform(item => TransformUtil.fromClassMany(item.collection), { toPlainOnly: true })
    @Transform(items => new LedgerBlocksLast(TransformUtil.toClassMany(LedgerBlock, items)), { toClassOnly: true })
    public blocksLast: LedgerBlocksLast;

    @Exclude()
    public blockLast: LedgerBlock;
    @Exclude()
    public eventsLast: LedgerBlockEventsLast;
    @Exclude()
    public transactionsLast: LedgerBlockTransactionsLast;
}
