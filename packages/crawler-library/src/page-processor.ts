// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Reporter, reporterFactory } from 'accessibility-insights-report';
import * as Apify from 'apify';
import { AxePuppeteer } from 'axe-puppeteer';
import { isNil } from 'lodash';
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
    private urlCount: number = 0;
    private dataset: Promise<Apify.Dataset>;
    private keyValueStore: Promise<Apify.KeyValueStore>;
    private readonly reporter = reporterFactory();

    public pageProcessor: Apify.PuppeteerHandlePage = async ({ page, request }) => {
        const enqueued = await enqueueLinks({
            page,
            requestQueue: this.requestQueue,
            pseudoUrls: this.discoveryPatterns,
        });
        console.log(`Discovered ${enqueued.length} URLs on page ${request.url}.`);

        const axePuppeteer: AxePuppeteer = new AxePuppeteer(page);
        const axeResults = await axePuppeteer.analyze();

        const pageData: PageData = {
            title: await page.title(),
            url: request.url,
            succeeded: true,
            axeResults,
        };
        this.urlCount += 1;

        const ds = await this.getDataSet();
        await ds.pushData(pageData);

        const kv = await this.getKeyValueStore();
        const report = this.reporter.fromAxeResult({
            results: axeResults,
            serviceName: 'Accessibility Insights CLI',
            description: `Automated report for accessibility scan of url ${request.url}`,
            scanContext: {
                pageTitle: pageData.title,
            },
        });

        await kv.setValue(`id-${this.urlCount}`, report.asHTML(), { contentType: 'text/html' });
        console.log(`Scanned page ${this.urlCount}: `, request.url);
    };

    private async getDataSet(): Promise<Apify.Dataset> {
        if (isNil(this.dataset)) {
            this.dataset = Apify.openDataset('scan-results');
        }

        return this.dataset;
    }

    private async getKeyValueStore(): Promise<Apify.KeyValueStore> {
        if (isNil(this.keyValueStore)) {
            this.keyValueStore = Apify.openKeyValueStore('scan-results-key-value-store');
        }

        return this.keyValueStore;
    }
}
