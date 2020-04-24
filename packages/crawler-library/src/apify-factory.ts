// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as Apify from 'apify';
import { cloneDeep, isNil } from 'lodash';

export type Ctor<T> = {
    prototype: Object;
    new (queueId: string, queueName?: string | undefined, clientKey?: string | undefined): T;
};

class CustomRequest extends Apify.Request {
    public dequeued: boolean = false;
}

export class CustomRequestQueue extends Apify.RequestQueue {
    public queueId: string;
    private requests: { [key: string]: CustomRequest } = {};

    constructor(queueId: string) {
        super(queueId);
        this.queueId = queueId;
    }

    /**
     * @ignore
     */
    public inProgressCount(): number {
        throw new Error('Method not implemented.');
    }

    public async addRequest(
        request: Apify.Request | Apify.RequestOptions,
        options?: {
            /**
             * Resolves to `true` if all requests were already handled and there are no more left.
             * Due to the nature of distributed storage used by the queue,
             * the function might occasionally return a false negative,
             * but it will never return a false positive.
             *
             * @returns {Promise<boolean>}
             */ forefront?: boolean;
        },
    ): Promise<Apify.QueueOperationInfo> {
        if (isNil(request.uniqueKey)) {
            console.log('error', request);
        }

        if (isNil(this.requests[request.uniqueKey])) {
            // tslint:disable-next-line: no-object-literal-type-assertion

            this.requests[request.uniqueKey] = new CustomRequest(request);

            return {
                request: cloneDeep(this.requests[request.uniqueKey]),
                requestId: request.uniqueKey as string,
                wasAlreadyPresent: false,
                wasAlreadyHandled: false,
            };
        }

        return {
            request: cloneDeep(this.requests[request.uniqueKey]),
            requestId: request.uniqueKey as string,
            wasAlreadyPresent: true,
            wasAlreadyHandled: !isNil(this.requests[request.uniqueKey].handledAt),
        };
    }

    public async getRequest(requestId: string): Promise<Apify.Request> {
        return cloneDeep(this.requests[requestId]);
    }

    public async fetchNextRequest(): Promise<Apify.Request> {
        const request = await this.getFirstRequestToDequeue();
        if (!isNil(request)) {
            request.dequeued = true;
        }

        return cloneDeep(request);
    }

    public async markRequestHandled(request: Apify.Request): Promise<Apify.QueueOperationInfo> {
        const savedRequest = this.requests[request.uniqueKey];
        let alreadyHandled = false;

        if (!isNil(savedRequest)) {
            if (!isNil(savedRequest.handledAt)) {
                alreadyHandled = true;
            } else {
                savedRequest.handledAt = new Date();
            }
        }

        return {
            request: cloneDeep(savedRequest),
            requestId: request.id as string,
            wasAlreadyHandled: alreadyHandled,
            wasAlreadyPresent: !isNil(savedRequest),
        };
    }

    public async reclaimRequest(request: Apify.Request, options?: { forefront?: boolean }): Promise<Apify.QueueOperationInfo> {
        const savedRequest = this.requests[request.uniqueKey];
        let alreadyHandled = false;

        if (!isNil(savedRequest) && isNil(savedRequest.handledAt)) {
            savedRequest.dequeued = false;
        } else {
            alreadyHandled = true;
        }

        return {
            request: cloneDeep(savedRequest),
            requestId: request.id as string,
            wasAlreadyHandled: alreadyHandled,
            wasAlreadyPresent: !isNil(savedRequest),
        };
    }

    public async isEmpty(): Promise<boolean> {
        const request = await this.getFirstRequestToDequeue();

        return isNil(request);
    }

    public async isFinished(): Promise<boolean> {
        for (const key of Object.keys(this.requests)) {
            if (isNil(this.requests[key].handledAt)) {
                return false;
            }
        }

        return true;
    }

    public async drop(): Promise<void> {
        this.requests = {};
    }

    public async handledCount(): Promise<number> {
        let handledCount = 0;

        for (const key of Object.keys(this.requests)) {
            if (!isNil(this.requests[key].handledAt)) {
                handledCount += 1;
            }
        }

        return handledCount;
    }

    // tslint:disable-next-line: no-any
    public async getInfo(): Promise<any> {
        return {
            customQueue: true,
            queueId: this.queueId,
        };
    }

    //#region Unused Properties
    // tslint:disable

    public clientKey: string;
    public queueName: string;
    public queueHeadDict: any;
    public queryQueueHeadPromise: any;
    public inProgress: Set<any>;
    public recentlyHandled: any;
    public assumedTotalCount: number;
    public assumedHandledCount: number;
    public requestsCache: any;

    /**
     * @ignore
     */

    public _cacheRequest(cacheKey: any, queueOperationInfo: any): void {
        throw new Error('Method not implemented.');
    }

    /**
     * @ignore
     */
    public _ensureHeadIsNonEmpty(ensureConsistency?: boolean, limit?: number, iteration?: number): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    /**
     * @ignore
     */
    public _maybeAddRequestToQueueHead(requestId: any, forefront: any): void {
        throw new Error('Method not implemented.');
    }

    /**
     * @ignore
     */
    public delete(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    // tslint:enable
    //#endregion Unused Properties

    private async getFirstRequestToDequeue(): Promise<CustomRequest> {
        for (const key of Object.keys(this.requests)) {
            if (!this.requests[key].dequeued && isNil(this.requests[key].handledAt)) {
                return this.requests[key];
            }
        }

        return undefined;
    }
}

export class ApifyFactory {
    public async createRequestQueue(baseUrl: string): Promise<Apify.RequestQueue> {
        const requestQueue = new CustomRequestQueue('queueId-test');
        await requestQueue.addRequest({ url: baseUrl, uniqueKey: baseUrl });

        return requestQueue;
    }

    public async createRequestList(existingUrls: string[]): Promise<Apify.RequestList> {
        return Apify.openRequestList('existingUrls', existingUrls === undefined ? [] : existingUrls);
    }
}
