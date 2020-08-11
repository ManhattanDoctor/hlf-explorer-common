import { TransportHttp, TransportHttpCommandAsync, ITransportHttpSettings } from '@ts-core/common/transport/http';
import { ILogger } from '@ts-core/common/logger';
import { LedgerBlock, LedgerInfo, LedgerBlockEvent, LedgerBlockTransaction } from '../../ledger';
import { Loadable, LoadableStatus, LoadableEvent } from '@ts-core/common/Loadable';
import { ILedgerInfoGetResponse } from './info';
import { ILedgerBlockGetResponse } from './block';
import { ILedgerBlockEventGetResponse } from './event';
import { IPagination, Paginable } from '@ts-core/common/dto';
import * as io from 'socket.io-client';
// import { SocketIOClient } from 'socket.io-client';
import { ObservableData } from '@ts-core/common/observer';
import { ExtendedError } from '@ts-core/common/error';
import { TransformUtil, ObjectUtil, UrlUtil } from '@ts-core/common/util';
import { ILedgerBlockTransactionGetResponse } from './transaction';
import { LedgerSocketEvent, LEDGER_SOCKET_NAMESPACE } from './LedgerSocketEvent';
import { ILedgerSearchResponse } from './ILedgerSearchResponse';
import * as _ from 'lodash';

export class LedgerApi extends Loadable<LedgerSocketEvent, any> {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected error: ExtendedError;

    protected _http: TransportHttp;
    protected _socket: any;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger) {
        super();
        this._http = new TransportHttp(logger, { method: 'get' });
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

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public async search(query: string): Promise<LedgerBlock | LedgerBlockTransaction | LedgerBlockEvent> {
        let item = await this.http.sendListen(
            new TransportHttpCommandAsync<ILedgerSearchResponse>('api/ledger/search', { data: { query } })
        );

        let classType = null;
        if (ObjectUtil.instanceOf(item.value, ['number', 'rawData'])) {
            classType = LedgerBlock;
        } else if (ObjectUtil.instanceOf(item.value, ['requestId', 'requestName'])) {
            classType = LedgerBlockTransaction;
        } else if (ObjectUtil.instanceOf(item.value, ['name', 'transactionHash'])) {
            classType = LedgerBlockEvent;
        } else {
            throw new ExtendedError(`Unknown type`);
        }
        return TransformUtil.toClass(classType, item.value);
    }

    public async getInfo(nameOrId: number | string): Promise<LedgerInfo> {
        let item = await this.http.sendListen(new TransportHttpCommandAsync<ILedgerInfoGetResponse>(`api/ledger/info?nameOrId=${nameOrId}`));
        return LedgerInfo.toClass(item.value);
    }

    public async getInfoList(data?: Paginable<LedgerInfo>): Promise<IPagination<LedgerInfo>> {
        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerInfo>>(`api/ledger/infos`, { data })
        );
        items.items = items.items.map(item => LedgerInfo.toClass(item));
        return items;
    }

    public async getBlock(hashOrNumber: number | string): Promise<LedgerBlock> {
        let item = await this.http.sendListen(new TransportHttpCommandAsync<ILedgerBlockGetResponse>(`api/ledger/block?hashOrNumber=${hashOrNumber}`));
        return TransformUtil.toClass(LedgerBlock, item.value);
    }

    public async getBlockList(data?: Paginable<LedgerBlock>): Promise<IPagination<LedgerBlock>> {
        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerBlock>>(`api/ledger/blocks`, { data })
        );
        items.items = TransformUtil.toClassMany(LedgerBlock, items.items);
        return items;
    }

    public async getTransaction(hash: string): Promise<LedgerBlockTransaction> {
        let item = await this.http.sendListen(new TransportHttpCommandAsync<ILedgerBlockTransactionGetResponse>(`api/ledger/transaction?hash=${hash}`));
        return TransformUtil.toClass(LedgerBlockTransaction, item.value);
    }

    public async getTransactionList(data?: Paginable<LedgerBlockTransaction>): Promise<IPagination<LedgerBlockTransaction>> {
        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerBlockTransaction>>(`api/ledger/transactions`, { data })
        );
        items.items = TransformUtil.toClassMany(LedgerBlockTransaction, items.items);
        return items;
    }

    public async getEvent(uid: string): Promise<LedgerBlockEvent> {
        let item = await this.http.sendListen(new TransportHttpCommandAsync<ILedgerBlockEventGetResponse>(`api/ledger/event?uid=${uid}`));
        return TransformUtil.toClass(LedgerBlockEvent, item.value);
    }

    public async getEventList(data?: Paginable<LedgerBlockEvent>): Promise<IPagination<LedgerBlockEvent>> {
        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerBlockEvent>>(`ledger/events`, { data })
        );
        items.items = TransformUtil.toClassMany(LedgerBlockEvent, items.items);
        return items;
    }

    public connect(): void {
        if (this.isLoaded || this.isLoading) {
            return;
        }
        this.socket = io.connect(`${UrlUtil.parseUrl(this.url)}${LEDGER_SOCKET_NAMESPACE}`, { reconnectionAttempts: 3 });
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

        this._http.destroy();
        this._http = null;
    }

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    private proxyExceptionHandler = (error: ExtendedError): void => {
        this.exceptionHandler(error);
    };

    private proxyLedgersHandler = (items: Array<LedgerInfo>): void => {
        this.ledgersHandler(items.map(item => LedgerInfo.toClass(item)));
    };

    private proxyLedgerBlockParsed(ledger: Partial<LedgerInfo>): void {
        if (!_.isNil(ledger.blockLast)) {
            ledger.blockLast = TransformUtil.toClass(LedgerBlock, ledger.blockLast);
        }
        this.ledgerBlockParsed(ledger);
    }

    private proxyLedgerUpdatedHandler = (ledger: Partial<LedgerInfo>): void => {
        if (!_.isNil(ledger.blockLast)) {
            ledger.blockLast = TransformUtil.toClass(LedgerBlock, ledger.blockLast);
        }
        this.ledgerUpdatedHandler(ledger);
    };

    private proxySocketConnectedHandler = (event: any): void => {
        this.socketConnectedHandler(event);
    };

    private proxySocketErrorHandler = (event: any): void => {
        this.socketErrorHandler(event);
    };

    private proxySocketDisconnectedHandler = (event: any): void => {
        this.socketDisconnectedHandler(event);
    };

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    protected exceptionHandler(error: ExtendedError): void {
        this.observer.next(new ObservableData(LedgerSocketEvent.EXCEPTION, ExtendedError.create(error)));
    }

    protected ledgersHandler(items: Array<LedgerInfo>): void {
        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGERS, items));
    }

    protected ledgerBlockParsed(ledger: Partial<LedgerInfo>): void {
        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_BLOCK_PARSED, ledger));
    }

    protected ledgerUpdatedHandler(ledger: Partial<LedgerInfo>): void {
        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_UPDATED, ledger));
    }

    protected socketErrorHandler(event: any): void {
        this.error = new ExtendedError(event);
        this.status = LoadableStatus.ERROR;
    }

    protected socketConnectedHandler(event: any): void {
        this.status = LoadableStatus.LOADED;
    }

    protected socketDisconnectedHandler(event: any): void {
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
            this._socket.removeEventListener(LedgerSocketEvent.LEDGERS, this.proxyLedgersHandler);
            this._socket.removeEventListener(LedgerSocketEvent.LEDGER_UPDATED, this.proxyLedgerUpdatedHandler);
            this._socket.removeEventListener(LedgerSocketEvent.LEDGER_BLOCK_PARSED, this.proxyLedgerBlockParsed);
            this._socket.removeEventListener(LedgerSocketEvent.EXCEPTION, this.proxyExceptionHandler);
            this._socket.removeEventListener('error', this.proxySocketErrorHandler);
            this._socket.removeEventListener('connect', this.proxySocketConnectedHandler);
            this._socket.removeEventListener('disconnect', this.proxySocketDisconnectedHandler);
            this._socket.disconnect();
        }

        this._socket = value;

        if (this._socket) {
            this._socket.addEventListener(LedgerSocketEvent.LEDGERS, this.proxyLedgersHandler);
            this._socket.addEventListener(LedgerSocketEvent.LEDGER_UPDATED, this.proxyLedgerUpdatedHandler);
            this._socket.addEventListener(LedgerSocketEvent.LEDGER_BLOCK_PARSED, this.proxyLedgerBlockParsed);
            this._socket.addEventListener(LedgerSocketEvent.EXCEPTION, this.proxyExceptionHandler);
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
        return !_.isNil(this.settings) ? this.settings.baseURL : null;
    }

    public set url(value: string) {
        if (!_.isNil(this.settings)) {
            this.settings.baseURL = value;
        }
    }

    public get settings(): ITransportHttpSettings {
        return !_.isNil(this.http) ? this.http.settings : null;
    }

    public set settings(value: ITransportHttpSettings) {
        if (!_.isNil(this.http)) {
            this.http.settings = value;
        }
    }

    public get http(): TransportHttp {
        return this._http;
    }
}
