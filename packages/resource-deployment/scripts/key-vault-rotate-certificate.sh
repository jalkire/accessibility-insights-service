#!/bin/bash

# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

set -eo pipefail

certificateName="azSecPackCert"

exitWithUsageInfo() {
    echo "
Usage: $0 -k <key vault> [-n <key vault certificate name>] [-s <subscription name or id>]
"
    exit 1
}

loginToAzure() {
    if [[ $userType == "user" ]]; then
        if ! az account show 1>/dev/null; then
            az login
        fi
    else
        az login --identity 1>/dev/null
    fi
}

getCurrentUserDetails() {
    userType=$(az account show --query "user.type" -o tsv) || true
    principalName=$(az account show --query "user.name" -o tsv) || true

    if [[ $userType == "user" ]]; then
        echo "Running script using current user credentials"
    else
        echo "Running script using system managed identity"
    fi
}

grantUserAccessToKeyVault() {
    if [[ $userType == "user" ]]; then
        echo "Granting access to key vault for current user account"
        az keyvault set-policy --name "$keyVault" --upn "$principalName" --certificate-permissions get list create 1>/dev/null
    fi
}

revokeUserAccessToKeyVault() {
    if [[ $userType == "user" ]]; then
        echo "Revoking access to key vault for current user account"
        az keyvault delete-policy --name "$keyVault" --upn "$principalName" 1>/dev/null || true
    fi
}

# Read script arguments
while getopts ":k:n:s:" option; do
    case $option in
    s) subscription=${OPTARG} ;;
    k) keyVault=${OPTARG} ;;
    n) certificateName=${OPTARG} ;;
    *) exitWithUsageInfo ;;
    esac
done

if [[ -z $keyVault ]] || [[ -z $certificateName ]]; then
    exitWithUsageInfo
fi

if [[ ! -z $subscription ]]; then
    az account set --subscription "$subscription"
fi

getCurrentUserDetails
trap 'revokeUserAccessToKeyVault' EXIT

loginToAzure
grantUserAccessToKeyVault

echo "Creating new version of certificate..."
az keyvault certificate create --vault-name "$keyVault" --name "$certificateName" --policy "$(az keyvault certificate get-default-policy)" 1>/dev/null

thumbprint=$(az keyvault certificate show --name "$certificateName" --vault-name "$keyVault" --query "x509ThumbprintHex" -o tsv)
echo "Created new version of $certificateName certificate with thumbprint $thumbprint"
