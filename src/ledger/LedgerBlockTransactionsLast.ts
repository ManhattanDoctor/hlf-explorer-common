import { MapCollection } from '@ts-core/common';
import { LedgerBlockTransaction } from './LedgerBlockTransaction';
import * as _ from 'lodash';

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
        super('id', LedgerBlockTransactionsLast.MAX_LENGTH);
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
        return first.date.getTime() > second.date.getTime() ? -1 : 1;
    };
}
