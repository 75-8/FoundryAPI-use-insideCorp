targetScope = 'resourceGroup'

param location string
param basename string
param storageAccountName string
param storageAccountBlobEndpoint string
param managedIdentityResourceId string
param managedIdentityClientId string

// App Service Plan (Consumption Linux)
resource asp 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'asp-${basename}'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // Required for Linux
  }
}

// Single Function App hosting all functions
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: 'func-${basename}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityResourceId}': {}
    }
  }
  properties: {
    serverFarmId: asp.id
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      appSettings: [
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccountName
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: storageAccountBlobEndpoint
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: 'https://${storageAccountName}.queue.${environment().suffixes.storage}'
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: 'https://${storageAccountName}.table.${environment().suffixes.storage}'
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: managedIdentityClientId
        }
        {
          name: 'WEBSITE_TIME_ZONE'
          value: 'Asia/Tokyo'
        }
        {
          name: 'INGEST_TIMER_SCHEDULE'
          value: '0 */5 * * * *'
        }
        {
          name: 'ARCHIVE_TIMER_SCHEDULE'
          value: '0 0 3 * * *'
        }
        {
          name: 'AUDIT_STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'AZURE_STORAGE_BLOB_ENDPOINT'
          value: storageAccountBlobEndpoint
        }
        {
          name: 'BUFFER_QUEUE_NAME'
          value: 'buffer'
        }
        {
          name: 'ANALYTICS_CONTAINER'
          value: 'analytics'
        }
        {
          name: 'POISON_CONTAINER'
          value: 'poison'
        }
        {
          name: 'ARCHIVE_CONTAINER'
          value: 'archive'
        }
      ]
    }
  }
}

output funcAppName string = functionApp.name
output funcAppPrincipalId string = functionApp.identity.principalId
output funcAppHostName string = functionApp.properties.defaultHostName
