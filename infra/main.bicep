targetScope = 'subscription'

param location string = 'japaneast'
param env string = 'dev'
param tenantId string
param allowedOids string
param allowedCidrs string
param modelName string = 'gpt-5.4'
param modelCapacity int = 30000

var rgName = 'rg-foundry-${env}'
var basename = 'fndry${env}${uniqueString(subscription().subscriptionId)}'
var apimName = 'apim-${basename}'
var foundryName = 'cog-${basename}'
var logAnalyticsWorkspaceName = 'law-${basename}'
var appInsightsName = 'appi-${basename}'
var identityName = '${apimName}-mi'
var workbookName = 'wb-foundry-usage-${env}'
var storageAccountName = take('st${basename}', 24)
var auditApiKey = uniqueString(subscription().subscriptionId, 'audit-api-key')
var auditLogUrl = 'https://func-${basename}.azurewebsites.net/api/audit'

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: rgName
  location: location
}

// Managed Identity (User-Assigned)
module identity 'module/identity.bicep' = {
  scope: rg
  name: 'identity-deploy'
  params: {
    location: location
    identityName: identityName
  }
}

// Monitoring (Log Analytics + App Insights)
module monitoring 'module/monitoring.bicep' = {
  scope: rg
  name: 'monitoring-deploy'
  params: {
    location: location
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    appInsightsName: appInsightsName
  }
}

// Storage Account (Audit Logs)
module storage 'module/storage.bicep' = {
  scope: rg
  name: 'storage-deploy'
  params: {
    location: location
    storageAccountName: storageAccountName
  }
}

// Functions (HTTP & Batch)
module functions 'module/functions.bicep' = {
  scope: rg
  name: 'functions-deploy'
  params: {
    location: location
    basename: basename
    storageAccountName: storage.outputs.storageAccountName
    storageAccountBlobEndpoint: storage.outputs.blobEndpoint
    managedIdentityResourceId: identity.outputs.resourceId
    managedIdentityClientId: identity.outputs.clientId
  }
}

// Azure AI Foundry
module foundry 'module/foundry.bicep' = {
  scope: rg
  name: 'foundry-deploy'
  params: {
    location: location
    foundryName: foundryName
    modelName: modelName
    modelCapacity: modelCapacity
  }
}

// RBAC: Grant Managed Identity access to Foundry & Storage
module rbac 'module/rbac.bicep' = {
  scope: rg
  name: 'rbac-deploy'
  params: {
    foundryAccountName: foundryName
    principalId: identity.outputs.principalId
    storageAccountName: storage.outputs.storageAccountName
    funcAppPrincipalId: functions.outputs.funcAppPrincipalId
  }
}

// API Management
module apim 'module/apim.bicep' = {
  scope: rg
  name: 'apim-deploy'
  params: {
    location: location
    apimName: apimName
    foundryEndpoint: foundry.outputs.foundryEndpoint
    tenantId: tenantId
    allowedOids: allowedOids
    allowedCidrs: allowedCidrs
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    appInsightsInstrumentationKey: monitoring.outputs.appInsightsInstrumentationKey
    appInsightsId: '${rg.id}/providers/Microsoft.Insights/components/${appInsightsName}'
    managedIdentityClientId: identity.outputs.clientId
    auditLogUrl: auditLogUrl
    auditApiKey: auditApiKey
  }
}

// Workbook
module workbook 'module/workbook.bicep' = {
  scope: rg
  name: 'workbook-deploy'
  params: {
    location: location
    workbookName: workbookName
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

output apimGatewayUrl string = apim.outputs.apimGatewayUrl
output resourceGroupName string = rg.name
