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
import { PromiseHandler } from '@ts-core/common/promise';

export class LedgerApiSocket extends Loadable<LedgerSocketEvent, Partial<LedgerInfo> | Array<LedgerInfo> | LedgerSocketEventData | ExtendedError> {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _socket: any;
    protected _ledger: LedgerInfo;
    protected _settings: any;

    protected error: ExtendedError;
    protected eventDispatchers: Map<string, Subject<any>>;

    protected connectionPromise: PromiseHandler<void, ExtendedError>;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(protected logger: ILogger, url?: string, defaultLedgerName?: string) {
        super();
        this._settings = { defaultLedgerName, reconnectionAttempts: 3 };
        this.eventDispatchers = new Map();

        if (!_.isNil(url)) {
            this.url = url;
        }
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

    private ledgerFilter(ledgerId: number): boolean {
        if (_.isNil(ledgerId)) {
            throw new ExtendedError(`Ledger id is Nil`);
        }
        return !_.isNil(this.ledger) ? this.ledger.id === ledgerId : true;
    }

    private connectionResolve(): void {
        if (!_.isNil(this.connectionPromise)) {
            this.connectionPromise.resolve();
        }
    }

    private connectionReject(): void {
        if (!_.isNil(this.connectionPromise)) {
            this.connectionPromise.reject(this.error);
            this.connectionPromise = null;
        }
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

    public async connect(): Promise<void> {
        if (!_.isNil(this.connectionPromise)) {
            return this.connectionPromise.promise;
        }

        this.socket = io.connect(`${UrlUtil.parseUrl(this.url)}${LEDGER_SOCKET_NAMESPACE}`, this.settings);
        this.status = LoadableStatus.LOADING;

        this.connectionPromise = PromiseHandler.create();
        return this.connectionPromise.promise;
    }

    public disconnect(): void {
        if (this.status === LoadableStatus.NOT_LOADED) {
            return;
        }
        this.socket = null;
        this.status = LoadableStatus.NOT_LOADED;
        this.connectionReject();
    }

    public destroy(): void {
        super.destroy();
        this.disconnect();

        this._ledger = null;
        this._settings = null;

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

    private proxyLedgerListReceivedHandler = (items: Array<LedgerInfo>): void => {
        this.ledgerListReceivedHandler(items.map(item => LedgerInfo.toClass(item)));
    };

    private proxySocketConnectedHandler = (): void => {
        this.socketConnectedHandler();
    };

    private proxySocketErrorHandler = (event: any): void => {
        this.socketErrorHandler(event);
    };

    private proxySocketDisconnectedHandler = (reason: string): void => {
        this.socketDisconnectedHandler(reason);
    };

    private proxySocketReconnectErrorHandler = (event: any): void => {
        this.socketReconnectErrorHandler(event);
    };

    private proxySocketReconnectFailedHandler = (): void => {
        this.socketReconnectFailedHandler();
    };

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    protected ledgerListReceivedHandler(items: Array<LedgerInfo>): void {
        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_LIST_RECEIVED, items));

        if (!_.isNil(this.settings.defaultLedgerName)) {
            this._ledger = _.find(items, { name: this.settings.defaultLedgerName });
        }
        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_READY, this.ledger));
    }

    protected ledgerBlockParsed(ledger: Partial<LedgerInfo>): void {
        if (!this.ledgerFilter(ledger.id)) {
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

    protected ledgerUpdatedHandler(ledger: Partial<LedgerInfo>): void {
        if (!this.ledgerFilter(ledger.id)) {
            return;
        }

        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_UPDATED, ledger));
        if (_.isNil(this.ledger)) {
            return;
        }

        ObjectUtil.copyProperties(ledger, this.ledger);
        if (!_.isNil(ledger.blockLast)) {
            this.ledger.blocksLast.add(ledger.blockLast);
            this.ledger.eventsLast.addItems(ledger.blockLast.events);
            this.ledger.transactionsLast.addItems(ledger.blockLast.transactions);
        }
    }

    protected socketConnectedHandler(): void {
        this.error = null;
        this.status = LoadableStatus.LOADED;
        this.connectionResolve();
    }

    protected socketErrorHandler(reason: any): void {
        this.error = new ExtendedError(reason);
        this.status = LoadableStatus.NOT_LOADED;
        this.connectionReject();
    }

    protected socketDisconnectedHandler(reason: string): void {
        this.error = new ExtendedError(reason);
        this.status = LoadableStatus.NOT_LOADED;
        this.connectionReject();
    }

    protected socketConnectErrorHandler(event: any): void {
        this.error = ExtendedError.create(event);
    }

    protected socketReconnectErrorHandler(event: any): void {
        this.error = ExtendedError.create(event);
    }

    protected socketReconnectFailedHandler(): void {
        this.status = LoadableStatus.NOT_LOADED;
        this.connectionReject();
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
            this._socket.removeEventListener('reconnect_error', this.proxySocketReconnectErrorHandler);
            this._socket.removeEventListener('reconnect_failed', this.proxySocketReconnectFailedHandler);
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
            this._socket.addEventListener('reconnect_error', this.proxySocketReconnectErrorHandler);
            this._socket.addEventListener('reconnect_failed', this.proxySocketReconnectFailedHandler);
        }
    }

    //--------------------------------------------------------------------------
    //
    // 	Public Properties
    //
    //--------------------------------------------------------------------------

    public get ledger(): LedgerInfo {
        return this._ledger;
    }

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
}

//  io.SocketIOClient.ConnectOpts
export interface ILedgerSocketSettings extends SocketIOClient.ConnectOpts {
    url: string;
    defaultLedgerName?: string;
}

export const LEDGER_SOCKET_NAMESPACE = `ledger`;

export enum LedgerSocketEvent {
    LEDGER_READY = 'LEDGER_READY',

    LEDGER_UPDATED = 'LEDGER_UPDATED',
    LEDGER_BLOCK_PARSED = 'LEDGER_BLOCK_PARSED',
    LEDGER_LIST_RECEIVED = 'LEDGER_LIST_RECEIVED',
    LEDGER_EVENT_DISPATCHED = 'LEDGER_EVENT_DISPATCHED'
}

export interface LedgerSocketEventData<T = any> {
    id: number;
    event: ITransportEvent<T>;
}
