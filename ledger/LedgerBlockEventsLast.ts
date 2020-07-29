import { MapCollection } from '@ts-core/common/map';
import * as _ from 'lodash';
import { LedgerBlockEvent } from './LedgerBlockEvent';

export class LedgerBlockEventsLast extends MapCollection<LedgerBlockEvent> {
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

    constructor(items?: Array<LedgerBlockEvent>) {
        super('id', LedgerBlockEventsLast.MAX_LENGTH);

        if (!_.isEmpty(items)) {
            this.addItems(items);
        }
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public add(item: LedgerBlockEvent, isFirst: boolean): LedgerBlockEvent {
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

    private sortFunction = (first: LedgerBlockEvent, second: LedgerBlockEvent): number => {
        return first.createdDate.getTime() > second.createdDate.getTime() ? -1 : 1;
    };
}
