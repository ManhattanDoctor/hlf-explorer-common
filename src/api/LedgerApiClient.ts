import { ITransportCommand, ITransportCommandAsync, ITransportCommandOptions, Transport, TransformUtil, IPagination, ExtendedError, ILogger, TransportHttp, ITransportHttpSettings, IFilterable, IPaginable } from '@ts-core/common';
import { Ledger, LedgerBlock, LedgerBlockEvent, LedgerBlockTransaction } from '../ledger';
import { ILedgerBlockGetResponse, ILedgerBlockGetRequest, ILedgerBlockLastGetRequest, ILedgerBlockLastGetResponse } from './block';
import { ILedgerBlockEventGetResponse, ILedgerBlockEventGetRequest } from './event';
import { ILedgerBlockTransactionGetResponse, ILedgerBlockTransactionGetRequest } from './transaction';
import { ILedgerSearchResponse } from './ILedgerSearchResponse';
import { ILedgerRequestRequest } from './ILedgerRequestRequest';
import { ILedgerSearchRequest } from './ILedgerSearchRequest';
import { ILedgerResetRequest } from './ILedgerResetRequest';
import { ILedgerGetRequest, ILedgerGetResponse } from './ledger';
import * as _ from 'lodash';

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
            options = {} as ITransportCommandOptions;
        }
        await this.sign(command, options, ledgerName);
        return {
            request: TransformUtil.fromClass(command),
            isAsync: Transport.isCommandAsync(command),
            ledgerName: this.getLedgerName(ledgerName),
            options
        };
    }

    protected async sign<U>(command: ITransportCommand<U>, options: ITransportCommandOptions, ledgerName?: string): Promise<void> { }

    protected checkPaginable<U>(data: IPaginable<U>, ledgerName?: string): void {
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

    public async getLedger(nameOrId: number | string): Promise<Ledger> {
        let item = await this.call<ILedgerGetResponse, ILedgerGetRequest>(LEDGER_URL, { data: { nameOrId } });
        return TransformUtil.toClass(Ledger, item.value);
    }

    public async getLedgerList(data?: IFilterable<Ledger>): Promise<Array<Ledger>> {
        let items = await this.call<Array<Ledger>>(LEDGERS_URL, { data });
        return TransformUtil.toClassMany(Ledger, items);;
    }

    public async getBlock(hashOrNumber: number | string, ledgerName?: string): Promise<LedgerBlock> {
        let item = await this.call<ILedgerBlockGetResponse, ILedgerBlockGetRequest>(
            BLOCK_URL, {
            data: { hashOrNumber, ledgerName: this.getLedgerName(ledgerName) }
        });
        return TransformUtil.toClass(LedgerBlock, item.value);
    }

    public async getBlockLast(nameOrId: number | string): Promise<LedgerBlock> {
        let item = await this.call<ILedgerBlockLastGetResponse, ILedgerBlockLastGetRequest>(BLOCK_LAST_URL, { data: { nameOrId } });
        return TransformUtil.toClass(LedgerBlock, item.value);
    }

    public async getBlockList(data?: IPaginable<LedgerBlock>, ledgerName?: string): Promise<IPagination<LedgerBlock>> {
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

    public async getTransactionList(data?: IPaginable<LedgerBlockTransaction>, ledgerName?: string): Promise<IPagination<LedgerBlockTransaction>> {
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

    public async getEventList(data?: IPaginable<LedgerBlockEvent>, ledgerName?: string): Promise<IPagination<LedgerBlockEvent>> {
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
}

export interface ILedgerApiSettings extends ITransportHttpSettings {
    ledgerNameDefault?: string;
}

export const PREFIX_URL = 'api/ledger/';

export const EVENT_URL = PREFIX_URL + 'event';
export const EVENTS_URL = PREFIX_URL + 'events';

export const BLOCK_URL = PREFIX_URL + 'block';
export const BLOCK_LAST_URL = PREFIX_URL + 'blockLast';
export const BLOCKS_URL = PREFIX_URL + 'blocks';

export const TRANSACTION_URL = PREFIX_URL + 'transaction';
export const TRANSACTIONS_URL = PREFIX_URL + 'transactions';

export const LEDGER_URL = PREFIX_URL + 'ledger';
export const LEDGERS_URL = PREFIX_URL + 'ledgers';

export const RESET_URL = PREFIX_URL + 'reset';
export const SEARCH_URL = PREFIX_URL + 'search';
export const REQUEST_URL = PREFIX_URL + 'request';
