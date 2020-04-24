// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as Apify from 'apify';
import { PageData } from './page-data';

// tslint:disable: no-unsafe-any

const {
    utils: { enqueueLinks },
} = Apify;

export declare type PageProcessorType = 'ClassicPageProcessor';

export interface PageProcessorOptions {
    baseUrl: string;
    requestQueue: Apify.RequestQueue;
    discoveryPatterns?: string[];
}

export abstract class PageProcessorBase {
    // This function is called to extract data from a single web page
    // 'page' is an instance of Puppeteer.Page with page.goto(request.url) already called
    // 'request' is an instance of Request class with information about the page to load
    public abstract pageProcessor: Apify.PuppeteerHandlePage;

    public constructor(protected readonly requestQueue: Apify.RequestQueue, protected readonly discoveryPatterns?: string[]) {}

    // This function is called when the crawling of a request failed after several reties
    public pageErrorProcessor: Apify.HandleFailedRequest = async ({ request, error }) => {
        const pageData: PageData = {
            title: '',
            url: request.url,
            succeeded: false,
            error: JSON.stringify(error),
            requestErrors: request.errorMessages,
        };
        console.log('Failed to Scan page : ', pageData);
    };
}

export class ClassicPageProcessor extends PageProcessorBase {
    public pageProcessor: Apify.PuppeteerHandlePage = async ({ page, request }) => {
        const enqueued = await enqueueLinks({
            page,
            requestQueue: this.requestQueue,
            pseudoUrls: this.discoveryPatterns,
        });
        console.log(`Discovered ${enqueued.length} URLs on page ${request.url}.`);

        const pageData: PageData = {
            title: await page.title(),
            url: request.url,
            succeeded: true,
        };

        console.log('Scanned page : ', pageData);
    };
}
