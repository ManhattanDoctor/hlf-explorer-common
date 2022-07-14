import { LedgerBlock } from './LedgerBlock';
import { Exclude, Transform } from 'class-transformer';
import { TransformUtil } from '@ts-core/common';
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
        item.blockLast = item.blocksLast.getFirst();
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

    @Transform(params => TransformUtil.fromClassMany(params.value.collection), { toPlainOnly: true })
    @Transform(params => new LedgerBlocksLast(TransformUtil.toClassMany(LedgerBlock, params.value)), { toClassOnly: true })
    public blocksLast: LedgerBlocksLast;

    @Exclude()
    public blockLast: LedgerBlock;
    @Exclude()
    public eventsLast: LedgerBlockEventsLast;
    @Exclude()
    public transactionsLast: LedgerBlockTransactionsLast;
}
