import { MapCollection } from '@ts-core/common/map';
import { LedgerBlock } from './LedgerBlock';
import { Exclude } from 'class-transformer';
import * as _ from 'lodash';
import { LedgerBlockTransaction } from './LedgerBlockTransaction';

export class LedgerBlockTransactionsLast extends MapCollection<LedgerBlockTransaction> {
    // --------------------------------------------------------------------------
    //
    //  Constants
    //
    // --------------------------------------------------------------------------

    public static MAX_LENGTH = 10;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(items?: Array<LedgerBlockTransaction>) {
        super('hash', LedgerBlockTransactionsLast.MAX_LENGTH);

        if (!_.isEmpty(items)) {
            this.addItems(items);
        }
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public add(item: LedgerBlockTransaction, isFirst: boolean): LedgerBlockTransaction {
        item = super.add(item, isFirst);
        if (!_.isNil(item)) {
            this.sort();
        }
        return item;
    }

    public sort(): void {
        this.collection.sort(this.sortFunction);
    }

    // --------------------------------------------------------------------------
    //
    //  Private Methods
    //
    // --------------------------------------------------------------------------

    private sortFunction = (first: LedgerBlockTransaction, second: LedgerBlockTransaction): number => {
        return first.createdDate.getTime() > second.createdDate.getTime() ? -1 : 1;
    };
}
