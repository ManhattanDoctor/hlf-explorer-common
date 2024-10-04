import { LedgerBlock, LedgerInfo } from '../ledger';
import { ILogger, ITransportEvent, TransformUtil, UrlUtil, ExtendedError, ObservableData, ObjectUtil } from '@ts-core/common';
import { Observable, Subject } from 'rxjs';
import { ISocketClientBaseSettings, SocketClient } from '@ts-core/socket';
import { Socket } from 'socket.io-client';
import * as io from 'socket.io-client';
import * as _ from 'lodash';

export class LedgerApiSocket extends SocketClient<
    LedgerSocketEvent,
    Partial<LedgerInfo> | Array<LedgerInfo> | LedgerSocketEventData | ExtendedError,
    ILedgerSocketSettings
> {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _ledgerDefault: LedgerInfo;
    protected eventDispatchers: Map<string, Subject<any>>;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(protected logger: ILogger, url?: string, ledgerNameDefault?: string) {
        super(logger, { url, ledgerNameDefault, reconnectionAttempts: 3 });
        this.eventDispatchers = new Map();
    }

    //--------------------------------------------------------------------------
    //
    // 	Protected Methods
    //
    //--------------------------------------------------------------------------

    private ledgerDefaultFilter(ledgerId: number): boolean {
        if (_.isNil(ledgerId)) {
            throw new ExtendedError(`Ledger id is Nil`);
        }
        return !_.isNil(this.ledgerDefault) ? this.ledgerDefault.id === ledgerId : true;
    }

    protected eventListenersAdd(socket: Socket): void {
        socket.on(LedgerSocketEvent.LEDGER_RESETED, this.proxyLedgerResetedHandler);
        socket.on(LedgerSocketEvent.LEDGER_UPDATED, this.proxyLedgerUpdatedHandler);
        socket.on(LedgerSocketEvent.LEDGER_BLOCK_PARSED, this.proxyLedgerBlockParsed);
        socket.on(LedgerSocketEvent.LEDGER_LIST_RECEIVED, this.proxyLedgerListReceivedHandler);
    }

    protected eventListenersRemove(socket: Socket): void {
        socket.off(LedgerSocketEvent.LEDGER_RESETED, this.proxyLedgerResetedHandler);
        socket.off(LedgerSocketEvent.LEDGER_UPDATED, this.proxyLedgerUpdatedHandler);
        socket.off(LedgerSocketEvent.LEDGER_BLOCK_PARSED, this.proxyLedgerBlockParsed);
        socket.off(LedgerSocketEvent.LEDGER_LIST_RECEIVED, this.proxyLedgerListReceivedHandler);
    }

    protected createSocket(): Socket {
        return io.connect(`${UrlUtil.parseUrl(this.url)}${LEDGER_SOCKET_NAMESPACE}`, this.settings);
    }

    // --------------------------------------------------------------------------
    //
    //  Command Methods
    //
    // --------------------------------------------------------------------------

    public getEventDispatcher<T>(name: string): Observable<T> {
        let item = this.eventDispatchers.get(name);
        if (_.isNil(item)) {
            item = new Subject<T>();
            this.eventDispatchers.set(name, item);
        }
        return item.asObservable();
    }

    // --------------------------------------------------------------------------
    //
    //  Socket Methods
    //
    // --------------------------------------------------------------------------

    public destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        super.destroy();

        this.disconnect();

        this._settings = null;
        this._ledgerDefault = null;

        this.eventDispatchers.forEach(item => item.complete());
        this.eventDispatchers.clear();
        this.eventDispatchers = null;

        this.logger = null;
    }

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    private proxyLedgerBlockParsed = (ledger: Partial<LedgerInfo>): void => {
        if (!_.isNil(ledger.blockLast)) {
            ledger.blockLast = TransformUtil.toClass(LedgerBlock, ledger.blockLast);
        }
        this.ledgerBlockParsed(ledger);
    };

    private proxyLedgerUpdatedHandler = (ledger: Partial<LedgerInfo>): void => {
        if (!_.isNil(ledger.blockLast)) {
            ledger.blockLast = TransformUtil.toClass(LedgerBlock, ledger.blockLast);
        }
        this.ledgerUpdatedHandler(ledger);
    };

    private proxyLedgerResetedHandler = (ledger: Partial<LedgerInfo>): void => {
        this.ledgerResetedHandler(ledger);
    };

    private proxyLedgerListReceivedHandler = (items: Array<LedgerInfo>): void => {
        this.ledgerListReceivedHandler(items.map(item => LedgerInfo.toClass(item)));
    };

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    protected ledgerListReceivedHandler(items: Array<LedgerInfo>): void {
        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_LIST_RECEIVED, items));

        if (_.isNil(this.settings.ledgerNameDefault)) {
            return;
        }

        this._ledgerDefault = _.find(items, { name: this.settings.ledgerNameDefault });
        this.observer.next(
            new ObservableData(
                !_.isNil(this.ledgerDefault) ? LedgerSocketEvent.LEDGER_DEFAULT_FOUND : LedgerSocketEvent.LEDGER_DEFAULT_NOT_FOUND,
                this.ledgerDefault
            )
        );
    }

    protected ledgerBlockParsed(ledger: Partial<LedgerInfo>): void {
        if (!this.ledgerDefaultFilter(ledger.id)) {
            return;
        }

        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_BLOCK_PARSED, ledger));

        let item = ledger.blockLast;
        if (_.isNil(item) || _.isEmpty(item.events)) {
            return;
        }
        for (let event of item.events) {
            this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_EVENT_DISPATCHED, { id: ledger.id, event: event.data }));
            if (this.eventDispatchers.has(event.name)) {
                this.eventDispatchers.get(event.name).next(event.data);
            }
        }
    }

    protected ledgerResetedHandler(ledger: Partial<LedgerInfo>): void {
        if (!this.ledgerDefaultFilter(ledger.id)) {
            return;
        }

        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_RESETED, ledger));

        if (_.isNil(this.ledgerDefault)) {
            return;
        }

        ObjectUtil.copyProperties(ledger, this.ledgerDefault);
        this.ledgerDefault.blocksLast.clear();
        this.ledgerDefault.eventsLast.clear();
        this.ledgerDefault.transactionsLast.clear();
    }

    protected ledgerUpdatedHandler(ledger: Partial<LedgerInfo>): void {
        if (!this.ledgerDefaultFilter(ledger.id)) {
            return;
        }

        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_UPDATED, ledger));
        if (_.isNil(this.ledgerDefault)) {
            return;
        }

        ObjectUtil.copyProperties(ledger, this.ledgerDefault);
        if (!_.isNil(ledger.blockLast)) {
            this.ledgerDefault.blocksLast.add(ledger.blockLast);
            this.ledgerDefault.eventsLast.addItems(ledger.blockLast.events);
            this.ledgerDefault.transactionsLast.addItems(ledger.blockLast.transactions);
        }
    }

    //--------------------------------------------------------------------------
    //
    // 	Public Properties
    //
    //--------------------------------------------------------------------------

    public get ledgerDefault(): LedgerInfo {
        return this._ledgerDefault;
    }
}

export interface ILedgerSocketSettings extends ISocketClientBaseSettings {
    url: string;
    ledgerNameDefault?: string;
}

export const LEDGER_SOCKET_NAMESPACE = `ledger`;

export enum LedgerSocketEvent {
    LEDGER_DEFAULT_FOUND = 'LEDGER_DEFAULT_FOUND',
    LEDGER_DEFAULT_NOT_FOUND = 'LEDGER_DEFAULT_NOT_FOUND',

    LEDGER_RESETED = 'LEDGER_RESETED',
    LEDGER_UPDATED = 'LEDGER_UPDATED',
    LEDGER_BLOCK_PARSED = 'LEDGER_BLOCK_PARSED',
    LEDGER_LIST_RECEIVED = 'LEDGER_LIST_RECEIVED',
    LEDGER_EVENT_DISPATCHED = 'LEDGER_EVENT_DISPATCHED'
}

export interface LedgerSocketEventData<T = any> {
    id: number;
    event: ITransportEvent<T>;
}
