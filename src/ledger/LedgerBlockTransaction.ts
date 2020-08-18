import * as _ from 'lodash';
import { Type } from 'class-transformer';
import { ObjectUtil } from '@ts-core/common/util';
import { ITransportCommandOptions } from '@ts-core/common/transport';
import { ExtendedError } from '@ts-core/common/error';

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
    //  Propertes
    //
    // --------------------------------------------------------------------------

    public id: number;
    public uid: string;

    public hash: string;
    public channel: string;
    public blockNumber: number;

    @Type(() => Date)
    public createdDate: Date;

    public requestId: string;
    public requestName: string;
    public requestUserId: string;

    public responseErrorCode: number;

    public request: ILedgerBlockTransactionRequestPayload;
    public response: ILedgerBlockTransactionResponsePayload;
    public chaincode: ILedgerBlockTransactionChaincode;

    // FabricTransactionValidationCode
    public validationCode: number;
}

// ITransportFabricRequestPayload
export interface ILedgerBlockTransactionRequestPayload<U = any> {
    id: string;
    name: string;
    request: U;
    options: ITransportCommandOptions;
    isNeedReply: boolean;
}

// ITransportFabricResponsePayload
export interface ILedgerBlockTransactionResponsePayload<V = any> {
    id: string;
    response?: ExtendedError | V;
}

// ITransportFabricTransactionChaincode
export interface ILedgerBlockTransactionChaincode {
    name: string;
    path: string;
    version: string;
}
