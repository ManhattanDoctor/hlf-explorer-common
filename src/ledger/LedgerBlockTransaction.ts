import * as _ from 'lodash';
import { Type } from 'class-transformer';
import { ITransportFabricTransaction } from '@ts-core/blockchain-fabric/transport/block/ITransportFabricTransaction';
import { ITransportFabricRequestPayload } from '@ts-core/blockchain-fabric/transport/TransportFabricRequestPayload';
import { ITransportFabricResponsePayload } from '@ts-core/blockchain-fabric/transport/TransportFabricResponsePayload';
import { FabricTransactionValidationCode } from '@ts-core/blockchain-fabric/api/IFabricTransaction';
import { ITransportFabricTransactionChaincode } from '@ts-core/blockchain-fabric/transport/block/ITransportFabricTransaction';
import { ObjectUtil } from '@ts-core/common/util';

export class LedgerBlockTransaction implements ITransportFabricTransaction {
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

    public request: ITransportFabricRequestPayload;
    public response: ITransportFabricResponsePayload;
    public chaincode: ITransportFabricTransactionChaincode;

    public validationCode: FabricTransactionValidationCode;
}