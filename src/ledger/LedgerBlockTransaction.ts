import * as _ from 'lodash';
import { Type } from 'class-transformer';
import { ObjectUtil } from '@ts-core/common';
import { ITransportCommandOptions } from '@ts-core/common';
import { ExtendedError } from '@ts-core/common';

export class LedgerBlockTransaction {
    // --------------------------------------------------------------------------
    //
    //  Static Methods
    //
    // --------------------------------------------------------------------------

    public static instanceOf(data: any): data is LedgerBlockTransaction {
        return ObjectUtil.instanceOf(data, ['requestId', 'requestName']);
    }

    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    public id: number;
    public hash: string;
    public channel: string;
    public blockNumber: number;

    public isBatch?: boolean;
    public blockMined?: number;

    @Type(() => Date)
    public date: Date;

    public requestId: string;
    public requestName: string;
    public requestUserId: string;

    public validationCode: number;
    public responseErrorCode: number;

    public request: ILedgerBlockTransactionRequestPayload;
    public response: ILedgerBlockTransactionResponsePayload;
    public chaincode: ILedgerBlockTransactionChaincode;
}

export interface ILedgerBlockTransactionRequestPayload<U = any> {
    id: string;
    name: string;
    request: U;
    options: ITransportCommandOptions;
    isNeedReply: boolean;
}

export interface ILedgerBlockTransactionResponsePayload<V = any> {
    id: string;
    response?: ExtendedError | V;
}

export interface ILedgerBlockTransactionChaincode {
    name: string;
    path: string;
    version: string;
}
