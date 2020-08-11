import { TransportHttp, TransportHttpCommandAsync, ITransportHttpSettings, TransportHttpCommand } from '@ts-core/common/transport/http';
import { ILogger } from '@ts-core/common/logger';
import { LedgerBlock, LedgerInfo, LedgerBlockEvent, LedgerBlockTransaction } from '../../ledger';
import { Loadable, LoadableStatus, LoadableEvent } from '@ts-core/common/Loadable';
import { ILedgerInfoGetResponse, ILedgerInfoGetRequest } from './info';
import { ILedgerBlockGetResponse, ILedgerBlockGetRequest } from './block';
import { ILedgerBlockEventGetResponse, ILedgerBlockEventGetRequest } from './event';
import { IPagination, Paginable } from '@ts-core/common/dto';
import * as io from 'socket.io-client';
// import { SocketIOClient } from 'socket.io-client';
import { ObservableData } from '@ts-core/common/observer';
import { ExtendedError } from '@ts-core/common/error';
import { TransformUtil, ObjectUtil, UrlUtil } from '@ts-core/common/util';
import { ILedgerBlockTransactionGetResponse, ILedgerBlockTransactionGetRequest } from './transaction';
import { LedgerSocketEvent, LEDGER_SOCKET_NAMESPACE } from './LedgerSocketEvent';
import { ILedgerSearchResponse } from './ILedgerSearchResponse';
import * as _ from 'lodash';
import { TransportCommandFabric, TransportCommandFabricAsync } from '@ts-core/blockchain-fabric/transport/command';
import { ITransportFabricCommandOptions } from '@ts-core/blockchain-fabric/transport';
import { Transport } from '@ts-core/common/transport';
import { ILedgerCommandRequest } from './ILedgerCommandRequest';
import { ILedgerSearchRequest } from './ILedgerSearchRequest';

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

    protected createCommandRequest<U, V = any>(
        command: TransportCommandFabric<U> | TransportCommandFabricAsync<U, V>,
        options?: ITransportFabricCommandOptions,
        ledgerId?: number
    ): ILedgerCommandRequest {
        if (_.isNil(options)) {
            options = {} as any;
        }

        if (!_.isNil(this.settings.sign)) {
            options = this.settings.sign(command, options);
        }

        return {
            command: TransformUtil.fromClass(command),
            isAsync: Transport.isCommandAsync(command),
            ledgerId: this.getLedgerId(ledgerId),
            options
        };
    }

    protected checkPaginable<U>(data: Paginable<U>, ledgerId: number): void {
        if (_.isNil(data)) {
            return;
        }

        if (_.isNil(data.conditions)) {
            data.conditions = {};
        }
        Object.assign(data.conditions, { ledgerId: this.getLedgerId(ledgerId) });
    }

    protected getLedgerId(ledgerId?: number): number {
        return !_.isNil(ledgerId) ? ledgerId : this.settings.defaultLedgerId;
    }

    // --------------------------------------------------------------------------
    //
    //  Command Methods
    //
    // --------------------------------------------------------------------------

    public commandSend<U>(command: TransportCommandFabric<U>, options?: ITransportFabricCommandOptions, ledgerId?: number): void {
        this.http.send(
            new TransportHttpCommand<ILedgerCommandRequest<U>>(`api/ledger/command`, {
                data: this.createCommandRequest(command, options, ledgerId),
                method: 'post'
            })
        );
    }

    public async commandSendListen<U, V>(command: TransportCommandFabricAsync<U, V>, options?: ITransportFabricCommandOptions, ledgerId?: number): Promise<V> {
        command.response(
            await this.http.sendListen(
                new TransportHttpCommandAsync<V, ILedgerCommandRequest<U>>(`api/ledger/command`, {
                    data: this.createCommandRequest(command, options, ledgerId),
                    method: 'post'
                })
            )
        );
        return command.data;
    }

    // --------------------------------------------------------------------------
    //
    //  Api Methods
    //
    // --------------------------------------------------------------------------

    public async search(query: string, ledgerId?: number): Promise<LedgerBlock | LedgerBlockTransaction | LedgerBlockEvent> {
        let item = await this.http.sendListen(
            new TransportHttpCommandAsync<ILedgerSearchResponse, ILedgerSearchRequest>('api/ledger/search', {
                data: { query, ledgerId: this.getLedgerId(ledgerId) }
            })
        );

        let classType = null;
        if (LedgerBlock.instanceOf(item.value)) {
            classType = LedgerBlock;
        } else if (LedgerBlockEvent.instanceOf(item.value)) {
            classType = LedgerBlockEvent;
        } else if (LedgerBlockTransaction.instanceOf(item.value)) {
            classType = LedgerBlockTransaction;
        } else {
            throw new ExtendedError(`Unknown response type`);
        }
        return TransformUtil.toClass(classType, item.value);
    }

    public async getInfo(nameOrId: number | string): Promise<LedgerInfo> {
        let item = await this.http.sendListen(
            new TransportHttpCommandAsync<ILedgerInfoGetResponse, ILedgerInfoGetRequest>(`api/ledger/info`, { data: { nameOrId } })
        );
        return LedgerInfo.toClass(item.value);
    }

    public async getInfoList(data?: Paginable<LedgerInfo>): Promise<IPagination<LedgerInfo>> {
        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerInfo>>(`api/ledger/infos`, { data })
        );
        items.items = items.items.map(item => LedgerInfo.toClass(item));
        return items;
    }

    public async getBlock(hashOrNumber: number | string, ledgerId?: number): Promise<LedgerBlock> {
        let item = await this.http.sendListen(
            new TransportHttpCommandAsync<ILedgerBlockGetResponse, ILedgerBlockGetRequest>(`api/ledger/block`, {
                data: { hashOrNumber, ledgerId: this.getLedgerId(ledgerId) }
            })
        );
        return TransformUtil.toClass(LedgerBlock, item.value);
    }

    public async getBlockList(data?: Paginable<LedgerBlock>, ledgerId?: number): Promise<IPagination<LedgerBlock>> {
        this.checkPaginable(data, ledgerId);

        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerBlock>>(`api/ledger/blocks`, { data })
        );
        items.items = TransformUtil.toClassMany(LedgerBlock, items.items);
        return items;
    }

    public async getTransaction(hash: string, ledgerId?: number): Promise<LedgerBlockTransaction> {
        let item = await this.http.sendListen(
            new TransportHttpCommandAsync<ILedgerBlockTransactionGetResponse, ILedgerBlockTransactionGetRequest>(`api/ledger/transaction`, {
                data: { hash, ledgerId: this.getLedgerId(ledgerId) }
            })
        );
        return TransformUtil.toClass(LedgerBlockTransaction, item.value);
    }

    public async getTransactionList(data?: Paginable<LedgerBlockTransaction>, ledgerId?: number): Promise<IPagination<LedgerBlockTransaction>> {
        this.checkPaginable(data, ledgerId);

        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerBlockTransaction>>(`api/ledger/transactions`, { data })
        );
        items.items = TransformUtil.toClassMany(LedgerBlockTransaction, items.items);
        return items;
    }

    public async getEvent(uid: string, ledgerId?: number): Promise<LedgerBlockEvent> {
        let item = await this.http.sendListen(
            new TransportHttpCommandAsync<ILedgerBlockEventGetResponse, ILedgerBlockEventGetRequest>(`api/ledger/event`, {
                data: { uid, ledgerId: this.getLedgerId(ledgerId) }
            })
        );
        return TransformUtil.toClass(LedgerBlockEvent, item.value);
    }

    public async getEventList(data?: Paginable<LedgerBlockEvent>, ledgerId?: number): Promise<IPagination<LedgerBlockEvent>> {
        this.checkPaginable(data, ledgerId);

        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerBlockEvent>>(`api/ledger/events`, { data })
        );
        items.items = TransformUtil.toClassMany(LedgerBlockEvent, items.items);
        return items;
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

    public get settings(): ILedgerApiSettings {
        return !_.isNil(this.http) ? this.http.settings : null;
    }

    public set settings(value: ILedgerApiSettings) {
        if (!_.isNil(this.http)) {
            this.http.settings = value;
        }
    }

    public get http(): TransportHttp {
        return this._http;
    }
}

export interface ILedgerApiSettings extends ITransportHttpSettings {
    sign?: <U, V = any>(
        command: TransportCommandFabric<U> | TransportCommandFabricAsync<U, V>,
        options: ITransportFabricCommandOptions
    ) => ITransportFabricCommandOptions;

    defaultLedgerId?: number;
}
