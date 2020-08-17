import { TransportHttp, TransportHttpCommandAsync, ITransportHttpSettings, TransportHttpCommand } from '@ts-core/common/transport/http';
import { ILogger } from '@ts-core/common/logger';
import { LedgerBlock, LedgerBlockEvent, LedgerBlockTransaction, LedgerInfo } from '../ledger';
import { ILedgerInfoGetResponse, ILedgerInfoGetRequest } from './info';
import { ILedgerBlockGetResponse, ILedgerBlockGetRequest } from './block';
import { ILedgerBlockEventGetResponse, ILedgerBlockEventGetRequest } from './event';
import { IPagination, Paginable } from '@ts-core/common/dto';
import { ExtendedError } from '@ts-core/common/error';
import { TransformUtil } from '@ts-core/common/util';
import { ILedgerBlockTransactionGetResponse, ILedgerBlockTransactionGetRequest } from './transaction';
import { ILedgerSearchResponse } from './ILedgerSearchResponse';
import * as _ from 'lodash';
import { TransportCommandFabric } from '@ts-core/blockchain-fabric/transport/command/TransportCommandFabric';
import { TransportCommandFabricAsync } from '@ts-core/blockchain-fabric/transport/command/TransportCommandFabricAsync';
import { ITransportFabricCommandOptions } from '@ts-core/blockchain-fabric/transport/ITransportFabricCommandOptions';
import { Transport } from '@ts-core/common/transport';
import { ILedgerCommandRequest } from './ILedgerCommandRequest';
import { ILedgerSearchRequest } from './ILedgerSearchRequest';
import { Destroyable } from '@ts-core/common/Destroyable';

export class LedgerApi extends Destroyable {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _http: TransportHttp;

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

    public requestSend<U>(command: TransportCommandFabric<U>, options?: ITransportFabricCommandOptions, ledgerId?: number): void {
        this.http.send(
            new TransportHttpCommand<ILedgerCommandRequest<U>>(`api/ledger/command`, {
                data: this.createCommandRequest(command, options, ledgerId),
                method: 'post'
            })
        );
    }

    public async requestSendListen<U, V>(command: TransportCommandFabricAsync<U, V>, options?: ITransportFabricCommandOptions, ledgerId?: number): Promise<V> {
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

    public destroy(): void {
        this._http.destroy();
        this._http = null;
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
