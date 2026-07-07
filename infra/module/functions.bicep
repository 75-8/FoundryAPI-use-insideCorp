targetScope = 'resourceGroup'

param location string
param basename string
param appInsightsConnectionString string
param storageAccountName string
param storageAccountBlobEndpoint string
param storageAccountQueueEndpoint string
param tags object = {}

resource asp 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'asp-${basename}'
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true
  }
}

resource funcAudit 'Microsoft.Web/sites@2022-09-01' = {
  name: 'func-audit-${basename}'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    httpsOnly: true
    serverFarmId: asp.id
    siteConfig: {
      linuxFxVersion: 'NODE|22'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME'; value: 'node' }
        { name: 'FUNCTIONS_EXTENSION_VERSION'; value: '~4' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'; value: appInsightsConnectionString }
        { name: 'AzureWebJobsStorage__accountName'; value: storageAccountName }
        { name: 'AzureWebJobsStorage__blobServiceUri'; value: storageAccountBlobEndpoint }
        { name: 'AzureWebJobsStorage__queueServiceUri'; value: storageAccountQueueEndpoint }
        { name: 'AUDIT_STORAGE_ACCOUNT_NAME'; value: storageAccountName }
        { name: 'AZURE_STORAGE_BLOB_ENDPOINT'; value: storageAccountBlobEndpoint }
        { name: 'AUDIT_QUEUE_NAME'; value: 'audit-log' }
        { name: 'ANALYTICS_CONTAINER'; value: 'analytics-log' }
        { name: 'POISON_CONTAINER'; value: 'poison-log' }
        { name: 'ARCHIVE_CONTAINER'; value: 'archive-log' }
      ]
    }
  }
}

output funcAuditName string = funcAudit.name
output funcAuditPrincipalId string = funcAudit.identity.principalId
output funcAuditHostName string = funcAudit.properties.defaultHostName
