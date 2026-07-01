targetScope = 'resourceGroup'

param location string
param basename string
param appInsightsConnectionString string
param storageAccountName string
param storageAccountBlobEndpoint string
param auditApiKey string

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

// Function App (HTTP Trigger)
resource funcHttp 'Microsoft.Web/sites@2022-09-01' = {
  name: 'func-http-${basename}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: asp.id
    siteConfig: {
      linuxFxVersion: 'NODE|22'
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
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccountName
        }
        {
          name: 'AZURE_STORAGE_BLOB_ENDPOINT'
          value: storageAccountBlobEndpoint
        }
        {
          name: 'AUDIT_API_KEY'
          value: auditApiKey
        }
      ]
    }
  }
}

// Function App (Batch Timer Trigger)
resource funcBatch 'Microsoft.Web/sites@2022-09-01' = {
  name: 'func-batch-${basename}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: asp.id
    siteConfig: {
      linuxFxVersion: 'NODE|22'
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
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccountName
        }
        {
          name: 'AZURE_STORAGE_BLOB_ENDPOINT'
          value: storageAccountBlobEndpoint
        }
        {
          name: 'WEBSITE_TIME_ZONE'
          value: 'Asia/Tokyo'
        }
      ]
    }
  }
}

output funcHttpName string = funcHttp.name
output funcHttpPrincipalId string = funcHttp.identity.principalId
output funcHttpHostName string = funcHttp.properties.defaultHostName

output funcBatchName string = funcBatch.name
output funcBatchPrincipalId string = funcBatch.identity.principalId
