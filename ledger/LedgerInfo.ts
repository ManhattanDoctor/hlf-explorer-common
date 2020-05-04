import { LedgerBlock } from './LedgerBlock';
import { Exclude, Transform } from 'class-transformer';

import { TransformUtil } from '@ts-core/common/util';
import { LedgerBlocksLast } from './LedgerBlocksLast';
import { PaginableDataSourceMapCollection } from '@ts-core/common/map/dataSource';
import { LedgerBlockTransactionsLast } from './LedgerBlockTransactionsLast';
import * as _ from 'lodash';

export class LedgerInfo {
    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public static toClass(value: any): LedgerInfo {
        let item = TransformUtil.toClass(LedgerInfo, value);
        item.blockLast = item.blocksLast.getLast();
        item.transactionsLast = new LedgerBlockTransactionsLast(_.flatten(item.blocksLast.collection.map(item => item.transactions)));
        return item;
    }

    public static fromClass(item: LedgerInfo): any {
        return TransformUtil.fromClass(item);
    }

    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    public id: number;
    public name: string;

    @Transform(item => item.collection.map(item => LedgerBlock.fromClass(item)), { toPlainOnly: true })
    @Transform(items => new LedgerBlocksLast(items.map(item => LedgerBlock.toClass(item))), { toClassOnly: true })
    public blocksLast: LedgerBlocksLast;

    @Exclude()
    public blockLast: LedgerBlock;
    @Exclude()
    public transactionsLast: LedgerBlockTransactionsLast;
}
