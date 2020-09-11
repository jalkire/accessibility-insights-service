// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Spinner } from 'cli-spinner';
import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import { isEmpty, isNil } from 'lodash';
import { SummaryReportResults, SummaryScanError, SummaryScanResult } from 'temp-report-package';
import { ReportDiskWriter } from '../report/report-disk-writer';
import { ReportGenerator } from '../report/report-generator';
import { AIScanner } from '../scanner/ai-scanner';
import { AxeScanResults, ScanError } from '../scanner/axe-scan-results';
import { ScanArguments } from '../scanner/scan-arguments';
import { CommandRunner } from './command-runner';

@injectable()
export class FileCommandRunner implements CommandRunner {
    // tslint:disable-next-line: no-object-literal-type-assertion
    private readonly summaryReportResults: SummaryReportResults = {
        failed: [],
        passed: [],
        unscannable: [],
    };

    private readonly uniqueUrls = new Set();

    constructor(
        @inject(AIScanner) private readonly scanner: AIScanner,
        @inject(ReportGenerator) private readonly reportGenerator: ReportGenerator,
        @inject(ReportDiskWriter) private readonly reportDiskWriter: ReportDiskWriter,
        private readonly fileSystemObj: typeof fs = fs,
    ) {}

    public async runCommand(scanArguments: ScanArguments): Promise<void> {
        const spinner = new Spinner(`Running scanner... %s \t`);
        spinner.start();
        // tslint:disable-next-line: no-any
        let promise = Promise.resolve();

        try {
            const lines = this.fileSystemObj.readFileSync(scanArguments.inputFile, 'utf-8').split(/\r?\n/);

            for (let line of lines) {
                line = line.trim();
                if (!isEmpty(line) && !this.uniqueUrls.has(line)) {
                    this.uniqueUrls.add(line);
                    await promise;
                    promise = this.processUrl(line, scanArguments);
                }
            }
        } finally {
            spinner.stop();
        }

        await promise;

        await this.generateSummaryReport(scanArguments);
    }

    private async generateSummaryReport(scanArguments: ScanArguments): Promise<void> {}

    private async processUrl(url: string, scanArguments: ScanArguments): Promise<void> {
        const axeResults = await this.scanner.scan(url);

        if (isNil(axeResults.error)) {
            const reportContent = this.reportGenerator.generateReport(axeResults);
            const reportName = this.reportDiskWriter.writeToDirectory(scanArguments.output, url, 'html', reportContent);

            this.processURLScanResult(url, reportName, axeResults);
        } else {
            let reportContent = (axeResults.error as ScanError).message;
            if (isEmpty(reportContent)) {
                reportContent = axeResults.error.toString();
            }

            const reportName = this.reportDiskWriter.writeToDirectory(scanArguments.output, url, 'txt', reportContent);

            const summaryScanError: SummaryScanError = {
                url: url,
                errorType: (axeResults.error as ScanError).errorType,
                errorDescription: reportName,
            };

            this.summaryReportResults.unscannable.push(summaryScanError);
            console.log(`Couldn't scan ${url}, error details saved in file ${reportName}`);
        }
    }

    private processURLScanResult(url: string, reportName: string, axeResults: AxeScanResults): void {
        if (axeResults.results.violations?.length > 0) {
            // tslint:disable-next-line: strict-boolean-expressions
            const issueCount = axeResults.results.violations.reduce((a, b) => a + b.nodes.length, 0);
            const summaryScanError: SummaryScanResult = {
                url: url,
                reportLocation: reportName,
                numFailures: issueCount,
            };
            this.summaryReportResults.failed.push(summaryScanError);
        } else {
            const issueCount = 0;

            const summaryScanError: SummaryScanResult = {
                url: url,
                reportLocation: reportName,
                numFailures: issueCount,
            };
            this.summaryReportResults.passed.push(summaryScanError);
        }
    }
}
