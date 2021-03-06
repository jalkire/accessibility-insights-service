#!/usr/bin/env node

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import 'reflect-metadata';
// eslint-disable-next-line import/no-unassigned-import
import './module-name-mapper';

// @ts-ignore
import * as cheerio from 'cheerio';
import { isEmpty } from 'lodash';
import * as yargs from 'yargs';
import { CliEntryPoint } from './cli-entry-point';
import { ScanArguments } from './scanner/scan-arguments';
import { setupCliContainer } from './setup-cli-container';

(async () => {
    const scanArguments = readScanArguments();

    const cliEntryPoint = new CliEntryPoint(setupCliContainer());
    await cliEntryPoint.runScan(scanArguments);
})().catch((error) => {
    console.log('Exception occurred while running the tool: ', error);
    process.exit(1);
});

function readScanArguments(): ScanArguments {
    const defaultOutputDir = 'ai_scan_cli_output';

    return (yargs
        .wrap(yargs.terminalWidth())
        .options({
            crawl: {
                type: 'boolean',
                describe: 'Crawl web site under the provided URL.',
                default: false,
            },
            url: {
                type: 'string',
                describe: 'The URL to scan (and crawl if --crawl option is selected) for accessibility issues.',
            },
            simulate: {
                type: 'boolean',
                describe: 'Simulate user click on elements that match to the specified selectors.',
                default: false,
            },
            selectors: {
                type: 'array',
                describe: `List of CSS selectors to match against, separated by space. Default selector is 'button'.`,
                default: [],
            },
            output: {
                type: 'string',
                describe: `Output directory. Defaults to the value of APIFY_LOCAL_STORAGE_DIR, if set, or ./${defaultOutputDir}, if not.`,
                default: defaultOutputDir,
            },
            maxUrls: {
                type: 'number',
                describe: `Maximum number of pages that the crawler will open. The crawl will stop when this limit is reached. Default is 100.
                           Note that in cases of parallel crawling, the actual number of pages visited might be slightly higher than this value.`,
                default: 100,
            },
            restart: {
                type: 'boolean',
                describe:
                    'Clear the pending crawl queue and start crawl from the provided URL when set to true, otherwise resume the crawl from the last request in the queue.',
                default: false,
            },
            continue: {
                type: 'boolean',
                describe: `Continue to crawl using the pending crawl queue. Use this option to continue when previous scan was terminated.
                           Note that --url option will be ignored and previous value will be used instead.`,
                default: false,
            },
            snapshot: {
                type: 'boolean',
                describe: 'Save snapshot of the crawled page. Enabled by default if simulation option is selected, otherwise false.',
            },
            memoryMBytes: {
                type: 'number',
                describe: 'The maximum number of megabytes to be used by the crawler.',
            },
            silentMode: {
                type: 'boolean',
                describe: 'Open browser window while crawling when set to true.',
                default: true,
            },
            inputFile: {
                type: 'string',
                describe: 'List of URLs to crawl in addition to URLs discovered from crawling the provided URL.',
            },
            existingUrls: {
                type: 'array',
                describe: `List of URLs to crawl in addition to URLs discovered from crawling the provided URL, separated by space.`,
            },
            discoveryPatterns: {
                type: 'array',
                describe: `List of RegEx patterns to crawl in addition to the provided URL, separated by space.`,
            },
        })
        .check((args) => {
            if (!args.crawl) {
                if ((isEmpty(args.url) && isEmpty(args.inputFile)) || (!isEmpty(args.url) && !isEmpty(args.inputFile))) {
                    throw new Error('Provide either --url or --inputFile option.');
                }
            } else {
                if (isEmpty(args.url)) {
                    throw new Error('The --url option is required.');
                }

                if (args.restart === true && args.continue === true) {
                    throw new Error('Options --restart and --continue are mutually exclusive.');
                }
            }

            return true;
        })
        .describe('help', 'Show help').argv as unknown) as ScanArguments;
}
