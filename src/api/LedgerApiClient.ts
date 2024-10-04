import { TransportHttp, ITransportHttpSettings } from '@ts-core/common';
import { ILogger } from '@ts-core/common';
import { LedgerBlock, LedgerBlockEvent, LedgerBlockTransaction, LedgerInfo } from '../ledger';
import { ILedgerInfoGetResponse, ILedgerInfoGetRequest } from './info';
import { ILedgerBlockGetResponse, ILedgerBlockGetRequest } from './block';
import { ILedgerBlockEventGetResponse, ILedgerBlockEventGetRequest } from './event';
import { IPagination, Paginable } from '@ts-core/common';
import { ExtendedError } from '@ts-core/common';
import { TransformUtil } from '@ts-core/common';
import { ILedgerBlockTransactionGetResponse, ILedgerBlockTransactionGetRequest } from './transaction';
import { ILedgerSearchResponse } from './ILedgerSearchResponse';
import * as _ from 'lodash';
import { ITransportCommand, ITransportCommandAsync, ITransportCommandOptions } from '@ts-core/common';
import { Transport } from '@ts-core/common';
import { ILedgerRequestRequest } from './ILedgerRequestRequest';
import { ILedgerSearchRequest } from './ILedgerSearchRequest';
import { ILedgerResetRequest } from './ILedgerResetRequest';

export class LedgerApiClient extends TransportHttp<ILedgerApiSettings> {

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger, url?: string, ledgerNameDefault?: string) {
        super(logger, { method: 'get', baseURL: url, ledgerNameDefault });
    }

    //--------------------------------------------------------------------------
    //
    // 	Protected Methods
    //
    //--------------------------------------------------------------------------

    protected async createRequest<U>(command: ITransportCommand<U>, options?: ITransportCommandOptions, ledgerName?: string): Promise<ILedgerRequestRequest> {
        if (_.isNil(options)) {
            options = {} as any;
        }
        return {
            request: TransformUtil.fromClass(command),
            isAsync: Transport.isCommandAsync(command),
            ledgerName: this.getLedgerName(ledgerName),
            options
        };
    }

    protected checkPaginable<U>(data: Paginable<U>, ledgerName?: string): void {
        if (_.isNil(data)) {
            return;
        }
        if (_.isNil(data.conditions)) {
            data.conditions = {};
        }
        Object.assign(data.conditions, { ledgerName: this.getLedgerName(ledgerName) });
    }

    protected getLedgerName(ledgerName?: string): string {
        return !_.isNil(ledgerName) ? ledgerName : this.settings.ledgerNameDefault;
    }

    // --------------------------------------------------------------------------
    //
    //  Command Methods
    //
    // --------------------------------------------------------------------------

    public async ledgerRequestSend<U>(command: ITransportCommand<U>, options?: ITransportCommandOptions, ledgerName?: string): Promise<void> {
        this.call<ILedgerRequestRequest<U>>(REQUEST_URL, {
            data: await this.createRequest(command, options, ledgerName),
            method: 'post'
        });
    }

    public async ledgerRequestSendListen<U, V>(command: ITransportCommandAsync<U, V>, options?: ITransportCommandOptions, ledgerName?: string): Promise<V> {
        command.response(
            await this.call<V, ILedgerRequestRequest<U>>(
                REQUEST_URL, {
                data: await this.createRequest(command, options, ledgerName),
                method: 'post'
            }));
        return command.data;
    }

    // --------------------------------------------------------------------------
    //
    //  Api Methods
    //
    // --------------------------------------------------------------------------

    public async getInfo(nameOrId: number | string): Promise<LedgerInfo> {
        let item = await this.call<ILedgerInfoGetResponse, ILedgerInfoGetRequest>(INFO_URL, { data: { nameOrId } });
        return LedgerInfo.toClass(item.value);
    }

    public async getInfoList(data?: Paginable<LedgerInfo>): Promise<IPagination<LedgerInfo>> {
        let items = await this.call<IPagination<LedgerInfo>>(INFOS_URL, { data });
        items.items = items.items.map(item => LedgerInfo.toClass(item));
        return items;
    }

    public async getBlock(hashOrNumber: number | string, ledgerName?: string): Promise<LedgerBlock> {
        let item = await this.call<ILedgerBlockGetResponse, ILedgerBlockGetRequest>(
            BLOCK_URL, {
            data: { hashOrNumber, ledgerName: this.getLedgerName(ledgerName) }
        });
        return TransformUtil.toClass(LedgerBlock, item.value);
    }

    public async getBlockList(data?: Paginable<LedgerBlock>, ledgerName?: string): Promise<IPagination<LedgerBlock>> {
        this.checkPaginable(data, ledgerName);

        let items = await this.call<IPagination<LedgerBlock>>(BLOCKS_URL, { data });
        items.items = TransformUtil.toClassMany(LedgerBlock, items.items);
        return items;
    }

    public async getTransaction(hash: string, ledgerName?: string): Promise<LedgerBlockTransaction> {
        let item = await this.call<ILedgerBlockTransactionGetResponse, ILedgerBlockTransactionGetRequest>(TRANSACTION_URL, {
            data: { hash, ledgerName: this.getLedgerName(ledgerName) }
        });
        return TransformUtil.toClass(LedgerBlockTransaction, item.value);
    }

    public async getTransactionList(data?: Paginable<LedgerBlockTransaction>, ledgerName?: string): Promise<IPagination<LedgerBlockTransaction>> {
        this.checkPaginable(data, ledgerName);

        let items = await this.call<IPagination<LedgerBlockTransaction>>(TRANSACTIONS_URL, { data });
        items.items = TransformUtil.toClassMany(LedgerBlockTransaction, items.items);
        return items;
    }

    public async getEvent(uid: string, ledgerName?: string): Promise<LedgerBlockEvent> {
        let item = await this.call<ILedgerBlockEventGetResponse, ILedgerBlockEventGetRequest>(
            EVENT_URL, {
            data: { uid, ledgerName: this.getLedgerName(ledgerName) }
        })
        return TransformUtil.toClass(LedgerBlockEvent, item.value);
    }

    public async getEventList(data?: Paginable<LedgerBlockEvent>, ledgerName?: string): Promise<IPagination<LedgerBlockEvent>> {
        this.checkPaginable(data, ledgerName);

        let items = await this.call<IPagination<LedgerBlockEvent>>(EVENTS_URL, { data });
        items.items = TransformUtil.toClassMany(LedgerBlockEvent, items.items);
        return items;
    }

    public async reset(password: string, ledgerName?: string): Promise<void> {
        await this.call<void, ILedgerResetRequest>(
            RESET_URL, {
            data: { password, ledgerName: this.getLedgerName(ledgerName) }
        })
    }

    public async search(query: string, ledgerName?: string): Promise<LedgerBlock | LedgerBlockTransaction | LedgerBlockEvent> {
        let item = await this.call<ILedgerSearchResponse, ILedgerSearchRequest>(
            SEARCH_URL, {
            data: { query, ledgerName: this.getLedgerName(ledgerName) }
        })

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

    //--------------------------------------------------------------------------
    //
    // 	Public Properties
    //
    //--------------------------------------------------------------------------

}

export interface ILedgerApiSettings extends ITransportHttpSettings {
    ledgerNameDefault?: string;
}

export const PREFIX_URL = 'api/ledger/';

export const EVENT_URL = PREFIX_URL + 'event';
export const EVENTS_URL = PREFIX_URL + 'events';

export const BLOCK_URL = PREFIX_URL + 'block';
export const BLOCKS_URL = PREFIX_URL + 'blocks';

export const TRANSACTION_URL = PREFIX_URL + 'transaction';
export const TRANSACTIONS_URL = PREFIX_URL + 'transactions';

export const INFO_URL = PREFIX_URL + 'info';
export const INFOS_URL = PREFIX_URL + 'infos';

export const RESET_URL = PREFIX_URL + 'reset';
export const SEARCH_URL = PREFIX_URL + 'search';
export const REQUEST_URL = PREFIX_URL + 'request';
