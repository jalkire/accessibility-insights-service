// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as Apify from 'apify';
import * as cheerio from 'cheerio';
import { ApifyFactory } from './apify-factory';
import { PageProcessorType } from './page-processor';
import { PageProcessorFactory } from './page-processor-factory';

// tslint:disable: no-unsafe-any

export interface CrawlerRunOptions {
    baseUrl: string;
    existingUrls?: string[];
    discoveryPatterns?: string[];
    pageProcessor?: PageProcessorType;
}

export class CrawlerEngine {
    public constructor(
        private readonly apifyFactory: ApifyFactory = new ApifyFactory(),
        private readonly pageProcessorFactory: PageProcessorFactory = new PageProcessorFactory(),
    ) {}

    public async start(crawlerRunOptions: CrawlerRunOptions): Promise<void> {
        // const requestList = await this.apifyFactory.createRequestList(crawlerRunOptions.existingUrls);
        const requestQueue = await this.apifyFactory.createRequestQueue(crawlerRunOptions.baseUrl);
        const pageProcessor = this.pageProcessorFactory.createPageProcessor(
            crawlerRunOptions.pageProcessor === undefined ? 'ClassicPageProcessor' : crawlerRunOptions.pageProcessor,
            {
                baseUrl: crawlerRunOptions.baseUrl,
                requestQueue,
                discoveryPatterns: crawlerRunOptions.discoveryPatterns,
            },
        );

        Apify.main(async () => {
            const crawler = new Apify.PuppeteerCrawler({
                // requestList,
                requestQueue,
                handlePageFunction: pageProcessor.pageProcessor,
                handleFailedRequestFunction: pageProcessor.pageErrorProcessor,
            });

            await crawler.run();

            const dataset = await Apify.openDataset('scan-results');

            const topResults = await dataset.getData({ format: 'json', limit: 2 });
            console.log('top n results fetched: ', topResults);

            const keyValueStore = await Apify.openKeyValueStore('scan-results-key-value-store');

            let lastKey: string;
            await keyValueStore.forEachKey((key, index, info) => {
                lastKey = key;
            });

            const storeData = await keyValueStore.getValue(lastKey);
            console.log('key value store data - ', storeData);
        });
    }
}
