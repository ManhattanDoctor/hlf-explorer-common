import { LedgerBlock, LedgerInfo } from '../ledger';
import { Loadable, LoadableStatus, LoadableEvent } from '@ts-core/common/Loadable';
import { ObjectUtil } from '@ts-core/common/util';
import * as io from 'socket.io-client';
import { ObservableData } from '@ts-core/common/observer';
import { ExtendedError } from '@ts-core/common/error';
import { TransformUtil, UrlUtil } from '@ts-core/common/util';
import * as _ from 'lodash';
import { ITransportEvent } from '@ts-core/common/transport';
import { Observable, Subject } from 'rxjs';
import { ILogger } from '@ts-core/common/logger';

export class LedgerApiSocket extends Loadable<LedgerSocketEvent, Partial<LedgerInfo> | Array<LedgerInfo> | LedgerSocketEventData | ExtendedError> {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _socket: any;
    protected _settings: any;

    protected error: ExtendedError;
    protected eventDispatchers: Map<string, Subject<any>>;

    protected _ledgerFiltered: LedgerInfo;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(protected logger: ILogger, protected ledgerFilterName?: string) {
        super();
        this._settings = { url: null, reconnectionAttempts: 3 };
        this.eventDispatchers = new Map();
    }

    //--------------------------------------------------------------------------
    //
    // 	Protected Methods
    //
    //--------------------------------------------------------------------------

    protected commitStatusChangedProperties(oldStatus: LoadableStatus, newStatus: LoadableStatus): void {
        super.commitStatusChangedProperties(oldStatus, newStatus);

        switch (newStatus) {
            case LoadableStatus.LOADING:
                this.observer.next(new ObservableData(LoadableEvent.STARTED));
                break;
            case LoadableStatus.LOADED:
                this.observer.next(new ObservableData(LoadableEvent.COMPLETE));
                break;
            case LoadableStatus.ERROR:
            case LoadableStatus.NOT_LOADED:
                this.observer.next(new ObservableData(LoadableEvent.ERROR, null, this.error));
                break;
        }

        if (oldStatus === LoadableStatus.LOADING) {
            this.observer.next(new ObservableData(LoadableEvent.FINISHED));
        }
    }

    protected ledgerFilter(ledgerId: number): boolean {
        if (_.isNil(ledgerId)) {
            throw new ExtendedError(`Ledger id is Nil`);
        }
        return !_.isNil(this.ledgerFiltered) ? this.ledgerFiltered.id === ledgerId : true;
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

    public connect(): void {
        if (this.isLoaded || this.isLoading) {
            return;
        }
        this.socket = io.connect(`${UrlUtil.parseUrl(this.url)}${LEDGER_SOCKET_NAMESPACE}`, this.settings);
        this.status = LoadableStatus.LOADING;
    }

    public disconnect(): void {
        if (this.status === LoadableStatus.NOT_LOADED || this.isError) {
            return;
        }
        this.socket = null;
        this.status = LoadableStatus.NOT_LOADED;
    }

    public destroy(): void {
        super.destroy();
        this.disconnect();

        this.eventDispatchers.forEach(item => item.complete());
        this.eventDispatchers.clear();
        this.eventDispatchers = null;

        this._ledgerFiltered = null;

        this.ledgerFilterName = null;
        this.logger = null;
    }

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    private proxyLedgerListReceivedHandler = (items: Array<LedgerInfo>): void => {
        this.ledgerListReceivedHandler(items.map(item => LedgerInfo.toClass(item)));
    };

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

    private proxySocketConnectedHandler = (event: any): void => {
        this.socketConnectedHandler();
    };

    private proxySocketErrorHandler = (event: any): void => {
        this.socketErrorHandler(event);
    };

    private proxySocketDisconnectedHandler = (event: any): void => {
        this.socketDisconnectedHandler();
    };

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    protected ledgerListReceivedHandler(items: Array<LedgerInfo>): void {
        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_LIST_RECEIVED, items));

        if (!_.isNil(this.ledgerFilterName)) {
            this._ledgerFiltered = _.find(items, { name: this.ledgerFilterName });
        }
    }

    protected ledgerBlockParsed(ledger: Partial<LedgerInfo>): void {
        if (!this.ledgerFilter(ledger.id)) {
            return;
        }

        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_BLOCK_PARSED, ledger));

        let item = ledger.blockLast;
        if (!_.isNil(item) && !_.isEmpty(item.events)) {
            return;
        }
        for (let event of item.events) {
            this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_EVENT_DISPATCHED, { id: ledger.id, event: event.data }));
            if (this.eventDispatchers.has(event.name)) {
                this.eventDispatchers.get(event.name).next(event.data);
            }
        }
    }

    protected ledgerUpdatedHandler(ledger: Partial<LedgerInfo>): void {
        if (!this.ledgerFilter(ledger.id)) {
            return;
        }

        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_UPDATED, ledger));
        if (_.isNil(this.ledgerFiltered)) {
            return;
        }

        ObjectUtil.copyProperties(ledger, this.ledgerFiltered);
        if (!_.isNil(ledger.blockLast)) {
            this.ledgerFiltered.blocksLast.add(ledger.blockLast);
            this.ledgerFiltered.eventsLast.addItems(ledger.blockLast.events);
            this.ledgerFiltered.transactionsLast.addItems(ledger.blockLast.transactions);
        }
    }

    protected socketErrorHandler(event: any): void {
        this.error = new ExtendedError(event);
        this.status = LoadableStatus.ERROR;
    }

    protected socketConnectedHandler(): void {
        this.status = LoadableStatus.LOADED;
    }

    protected socketDisconnectedHandler(): void {
        this.status = LoadableStatus.ERROR;
    }

    //--------------------------------------------------------------------------
    //
    // 	Private Properties
    //
    //--------------------------------------------------------------------------

    protected get socket(): any {
        return this._socket;
    }

    protected set socket(value: any) {
        if (value === this._socket) {
            return;
        }

        if (this._socket) {
            this._socket.removeEventListener(LedgerSocketEvent.LEDGER_UPDATED, this.proxyLedgerUpdatedHandler);
            this._socket.removeEventListener(LedgerSocketEvent.LEDGER_BLOCK_PARSED, this.proxyLedgerBlockParsed);
            this._socket.removeEventListener(LedgerSocketEvent.LEDGER_LIST_RECEIVED, this.proxyLedgerListReceivedHandler);
            this._socket.removeEventListener('error', this.proxySocketErrorHandler);
            this._socket.removeEventListener('connect', this.proxySocketConnectedHandler);
            this._socket.removeEventListener('disconnect', this.proxySocketDisconnectedHandler);
            this._socket.disconnect();
        }

        this._socket = value;

        if (this._socket) {
            this._socket.addEventListener(LedgerSocketEvent.LEDGER_UPDATED, this.proxyLedgerUpdatedHandler);
            this._socket.addEventListener(LedgerSocketEvent.LEDGER_BLOCK_PARSED, this.proxyLedgerBlockParsed);
            this._socket.addEventListener(LedgerSocketEvent.LEDGER_LIST_RECEIVED, this.proxyLedgerListReceivedHandler);
            this._socket.addEventListener('error', this.proxySocketErrorHandler);
            this._socket.addEventListener('connect', this.proxySocketConnectedHandler);
            this._socket.addEventListener('disconnect', this.proxySocketDisconnectedHandler);
        }
    }

    //--------------------------------------------------------------------------
    //
    // 	Public Properties
    //
    //--------------------------------------------------------------------------

    public get url(): string {
        return !_.isNil(this.settings) ? this.settings.url : null;
    }

    public set url(value: string) {
        if (!_.isNil(this.settings)) {
            this.settings.url = value;
        }
    }

    public get settings(): ILedgerSocketSettings {
        return this._settings;
    }

    public set settings(value: ILedgerSocketSettings) {
        if (value === this._settings) {
            return;
        }
        this._settings = value;
    }

    public get ledgerFiltered(): LedgerInfo {
        return this._ledgerFiltered;
    }
}

//  io.SocketIOClient.ConnectOpts
export interface ILedgerSocketSettings extends SocketIOClient.ConnectOpts {
    url: string;
}

export const LEDGER_SOCKET_NAMESPACE = `ledger`;

export enum LedgerSocketEvent {
    LEDGER_UPDATED = 'LEDGER_UPDATED',
    LEDGER_BLOCK_PARSED = 'LEDGER_BLOCK_PARSED',
    LEDGER_LIST_RECEIVED = 'LEDGER_LIST_RECEIVED',
    LEDGER_EVENT_DISPATCHED = 'LEDGER_EVENT_DISPATCHED'
}

export interface LedgerSocketEventData<T = any> {
    id: number;
    event: ITransportEvent<T>;
}
