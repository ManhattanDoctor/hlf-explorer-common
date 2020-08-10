import { TransportHttp, TransportHttpCommandAsync } from '@ts-core/common/transport/http';
import { ILogger } from '@ts-core/common/logger';
import { LedgerBlock, LedgerInfo, LedgerBlockEvent, LedgerBlockTransaction } from '../../ledger';
import { Loadable, LoadableStatus } from '@ts-core/common/Loadable';
import { ILedgerInfoGetResponse } from './info';
import { ILedgerBlockGetResponse } from './block';
import { ILedgerBlockEventGetResponse } from './event';
import { IPagination, Paginable } from '@ts-core/common/dto';
import * as io from 'socket.io-client';
import { SocketIOClient } from 'socket.io-client';
import { ObservableData } from '@ts-core/common/observer';
import { ExtendedError } from '@ts-core/common/error';
import { TransformUtil } from '@ts-core/common/util';
import { ILedgerBlockTransactionGetResponse } from './transaction';
import { LedgerSocketEvent, LEDGER_SOCKET_NAMESPACE } from './LedgerSocketEvent';

export class LedgerApi extends Loadable<LedgerSocketEvent, any> {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    private http: TransportHttp;
    private _socket: SocketIOClient.Socket;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger, private url: string) {
        super();
        this.http = new TransportHttp(logger, { baseURL: `${url}/api`, method: 'get' });
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public async getInfo(nameOrId: number | string): Promise<LedgerInfo> {
        let item = await this.http.sendListen(new TransportHttpCommandAsync<ILedgerInfoGetResponse>(`ledger/info?nameOrId=${nameOrId}`));
        return LedgerInfo.toClass(item.value);
    }

    public async getInfoList(data?: Paginable<LedgerInfo>): Promise<IPagination<LedgerInfo>> {
        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerInfo>>(`ledger/infos`, { data })
        );
        items.items = items.items.map(item => LedgerInfo.toClass(item));
        return items;
    }

    public async getBlock(hashOrNumber: number | string): Promise<LedgerBlock> {
        let item = await this.http.sendListen(new TransportHttpCommandAsync<ILedgerBlockGetResponse>(`ledger/block?hashOrNumber=${hashOrNumber}`));
        return TransformUtil.toClass(LedgerBlock, item.value);
    }

    public async getBlockList(data?: Paginable<LedgerBlock>): Promise<IPagination<LedgerBlock>> {
        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerBlock>>(`ledger/blocks`, { data })
        );
        items.items = TransformUtil.toClassMany(LedgerBlock, items.items);
        return items;
    }

    public async getTransaction(hash: string): Promise<LedgerBlockTransaction> {
        let item = await this.http.sendListen(new TransportHttpCommandAsync<ILedgerBlockTransactionGetResponse>(`ledger/transaction?hash=${hash}`));
        return TransformUtil.toClass(LedgerBlockTransaction, item.value);
    }

    public async getTransactionList(data?: Paginable<LedgerBlockTransaction>): Promise<IPagination<LedgerBlockTransaction>> {
        let items = await this.http.sendListen(
            new TransportHttpCommandAsync<IPagination<LedgerBlockTransaction>>(`ledger/transactions`, { data })
        );
        items.items = TransformUtil.toClassMany(LedgerBlockTransaction, items.items);
        return items;
    }

    public async getEvent(uid: string): Promise<LedgerBlockEvent> {
        let item = await this.http.sendListen(new TransportHttpCommandAsync<ILedgerBlockEventGetResponse>(`ledger/event?uid=${uid}`));
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
        this.socket = io.connect(`${this.url}/${LEDGER_SOCKET_NAMESPACE}`, { reconnectionAttempts: 3 });
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

        this.http.destroy();
        this.http = null;
    }

    //--------------------------------------------------------------------------
    //
    // 	Socket Event Handlers
    //
    //--------------------------------------------------------------------------

    protected exceptionHandler = (error: ExtendedError): void => {
        this.observer.next(new ObservableData(LedgerSocketEvent.EXCEPTION, ExtendedError.create(error)));
    };

    protected ledgersHandler = (items: Array<LedgerInfo>): void => {
        this.observer.next(
            new ObservableData(
                LedgerSocketEvent.LEDGERS,
                items.map(item => LedgerInfo.toClass(item))
            )
        );
    };

    protected ledgerBlockParsed = (ledger: Partial<LedgerInfo>): void => {
        ledger.blockLast = TransformUtil.toClass(LedgerBlock, ledger.blockLast);
        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_BLOCK_PARSED, ledger));
    };

    protected ledgerUpdatedHandler = (ledger: Partial<LedgerInfo>): void => {
        ledger.blockLast = TransformUtil.toClass(LedgerBlock, ledger.blockLast);
        this.observer.next(new ObservableData(LedgerSocketEvent.LEDGER_UPDATED, ledger));
    };

    protected socketErrorHandler = (event: any): void => {};

    protected socketConnectedHandler = (): void => {
        this.status = LoadableStatus.LOADED;
    };

    protected socketDisconnectedHandler = async (): Promise<void> => {
        this.status = LoadableStatus.ERROR;
    };

    //--------------------------------------------------------------------------
    //
    // 	Private Properties
    //
    //--------------------------------------------------------------------------

    protected get socket(): SocketIOClient.Socket {
        return this._socket;
    }

    protected set socket(value: SocketIOClient.Socket) {
        if (value === this._socket) {
            return;
        }

        if (this._socket) {
            this._socket.removeEventListener(LedgerSocketEvent.EXCEPTION, this.exceptionHandler);
            this._socket.removeEventListener(LedgerSocketEvent.LEDGERS, this.ledgersHandler);
            this._socket.removeEventListener(LedgerSocketEvent.LEDGER_UPDATED, this.ledgerUpdatedHandler);
            this._socket.removeEventListener(LedgerSocketEvent.LEDGER_BLOCK_PARSED, this.ledgerBlockParsed);
            this._socket.removeEventListener('error', this.socketErrorHandler);
            this._socket.removeEventListener('connect', this.socketConnectedHandler);
            this._socket.removeEventListener('disconnect', this.socketDisconnectedHandler);
            this._socket.disconnect();
        }

        this._socket = value;

        if (this._socket) {
            this._socket.addEventListener(LedgerSocketEvent.EXCEPTION, this.exceptionHandler);
            this._socket.addEventListener(LedgerSocketEvent.LEDGERS, this.ledgersHandler);
            this._socket.addEventListener(LedgerSocketEvent.LEDGER_UPDATED, this.ledgerUpdatedHandler);
            this._socket.addEventListener(LedgerSocketEvent.LEDGER_BLOCK_PARSED, this.ledgerBlockParsed);
            this._socket.addEventListener('error', this.socketErrorHandler);
            this._socket.addEventListener('connect', this.socketConnectedHandler);
            this._socket.addEventListener('disconnect', this.socketDisconnectedHandler);
        }
    }
}
