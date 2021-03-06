// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import 'reflect-metadata';

import { ServiceConfiguration, System } from 'common';
import { ConsoleLoggerClient, GlobalLogger } from 'logger';
import { TestRunResult } from 'service-library';
import { A11yServiceClient, A11yServiceCredential } from 'web-api-client';
import * as yargs from 'yargs';

/* eslint-disable radix, @typescript-eslint/no-explicit-any, @typescript-eslint/strict-boolean-expressions */
type Argv = {
    clientId: string;
    clientSecret: string;
    authorityUrl: string;
    waitTimeBeforeEvaluationInMinutes: string;
    evaluationIntervalInMinutes: string;
    releaseId: string;
    baseUrl: string;
};

const argv: Argv = yargs.argv as any;

const isTestTimeout = (startTime: Date, currentTime: Date, timeout: number): boolean => {
    return currentTime.getTime() - startTime.getTime() > timeout;
};

(async () => {
    const serviceConfig = new ServiceConfiguration();
    const logger = new GlobalLogger([new ConsoleLoggerClient(serviceConfig, console)], process);
    await logger.setup();
    const cred = new A11yServiceCredential(argv.clientId, argv.clientSecret, argv.clientId, argv.authorityUrl, logger);
    const client = new A11yServiceClient(cred, argv.baseUrl, logger);
    const testTimeoutInMinutes = 20;
    const waitTimeBeforeEvaluation = parseInt(argv.waitTimeBeforeEvaluationInMinutes) * 60000;
    const evaluationInterval = parseInt(argv.evaluationIntervalInMinutes) * 60000;

    logger.logInfo('Start evaluation of functional tests result.');
    logger.logInfo(`Waiting for ${argv.waitTimeBeforeEvaluationInMinutes} minutes before evaluating functional tests result.`);
    await System.wait(waitTimeBeforeEvaluation);

    let healthStatus: TestRunResult;
    const startTime = new Date();
    while (healthStatus !== 'pass') {
        try {
            logger.logInfo('Retrieving functional tests result.');

            const response = await client.checkHealth(`/release/${argv.releaseId}`);
            if (response.statusCode !== 200) {
                throw new Error(
                    JSON.stringify({ statusCode: response.statusCode, statusMessage: response.statusMessage, body: response.body }),
                );
            }

            logger.logInfo(`Functional tests result: ${JSON.stringify(response.body)}`);

            healthStatus = response.body.healthStatus;
        } catch (error) {
            logger.logInfo(`Failed to retrieve functional tests result. ${error}`);
        }

        if (healthStatus !== 'pass') {
            if (isTestTimeout(startTime, new Date(), testTimeoutInMinutes * 60000)) {
                logger.logInfo('Functional tests result validation timed out.');

                throw new Error('Functional tests result validation timed out.');
            }

            logger.logInfo(
                `Functional tests health status: ${healthStatus ? healthStatus : 'unknown'} . Waiting for next evaluation result.`,
            );

            await System.wait(evaluationInterval);
        } else {
            logger.logInfo('Functional tests succeeded.');
        }
    }
})().catch((error) => {
    console.log(`Exception: ${error}`);
    process.exit(1);
});
