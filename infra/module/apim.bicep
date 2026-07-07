targetScope = 'resourceGroup'

param location string
param apimName string
param publisherEmail string = 'admin@contoso.com'
param publisherName string = 'Contoso'
param foundryEndpoint string
param tenantId string
param allowedOids string
param allowedCidrs string
param logAnalyticsWorkspaceId string
param appInsightsInstrumentationKey string
param appInsightsId string
param managedIdentityClientId string
param auditLogUrl string
param auditApiKey string

// API Management (Consumption SKU)
resource apim 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: apimName
  location: location
  sku: {
    name: 'Consumption'
    capacity: 0
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', '${apimName}-mi')}': {}
    }
  }
}

// Named Values
resource nvAllowedOids 'Microsoft.ApiManagement/service/namedValues@2023-05-01-preview' = {
  parent: apim
  name: 'allowed-oids'
  properties: {
    displayName: 'allowed-oids'
    value: allowedOids
    secret: true
  }
}

resource nvAllowedCidrs 'Microsoft.ApiManagement/service/namedValues@2023-05-01-preview' = {
  parent: apim
  name: 'allowed-cidrs'
  properties: {
    displayName: 'allowed-cidrs'
    value: allowedCidrs
    secret: true
  }
}

resource nvTenantId 'Microsoft.ApiManagement/service/namedValues@2023-05-01-preview' = {
  parent: apim
  name: 'tenant-id'
  properties: {
    displayName: 'tenant-id'
    value: tenantId
  }
}

resource nvMiClientId 'Microsoft.ApiManagement/service/namedValues@2023-05-01-preview' = {
  parent: apim
  name: 'managed-identity-client-id'
  properties: {
    displayName: 'managed-identity-client-id'
    value: managedIdentityClientId
  }
}

resource nvAuditLogUrl 'Microsoft.ApiManagement/service/namedValues@2023-05-01-preview' = {
  parent: apim
  name: 'audit-log-url'
  properties: {
    displayName: 'audit-log-url'
    value: auditLogUrl
  }
}

resource nvAuditApiKey 'Microsoft.ApiManagement/service/namedValues@2023-05-01-preview' = {
  parent: apim
  name: 'audit-api-key'
  properties: {
    displayName: 'audit-api-key'
    value: auditApiKey
    secret: true
  }
}

// Backend (Foundry Endpoint)
resource backend 'Microsoft.ApiManagement/service/backends@2023-05-01-preview' = {
  parent: apim
  name: 'foundry-backend'
  properties: {
    url: foundryEndpoint
    protocol: 'http'
    description: 'Azure AI Foundry Backend'
  }
}

// API (Azure OpenAI Compatible)
resource api 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apim
  name: 'foundry-api'
  properties: {
    displayName: 'Azure AI Foundry Proxy'
    path: 'openai'
    protocols: [
      'https'
    ]
    subscriptionRequired: false // Entra ID JWT 認証を使用するためサブスクリプションキー不要
  }
}

// Catch-all Operation
resource operation 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'all-operations'
  properties: {
    displayName: 'All Operations'
    method: '*'
    urlTemplate: '/*'
    templateParameters: []
  }
}

// APIM Logger (Application Insights)
resource apimLogger 'Microsoft.ApiManagement/service/loggers@2023-05-01-preview' = {
  parent: apim
  name: 'appinsights-logger'
  properties: {
    loggerType: 'applicationInsights'
    resourceId: appInsightsId
    credentials: {
      instrumentationKey: appInsightsInstrumentationKey
    }
  }
}

// API Policy
resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: api
  name: 'policy'
  properties: {
    value: loadTextContent('../policies/apim-policy.xml')
    format: 'rawxml'
  }
  dependsOn: [
    nvAllowedOids
    nvAllowedCidrs
    nvTenantId
    nvMiClientId
    nvAuditLogUrl
    nvAuditApiKey
  ]
}

// Diagnostic Settings
resource diagnosticSetting 'Microsoft.ApiManagement/service/diagnostics@2023-05-01-preview' = {
  parent: apim
  name: 'applicationinsights'
  properties: {
    loggerId: apimLogger.id
    alwaysLog: 'allErrors'
    logClientIp: true
    sampling: {
      samplingType: 'fixed'
      percentage: 100
    }
  }
}

resource apimDiagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'apim-diag'
  scope: apim
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output apimGatewayUrl string = apim.properties.gatewayUrl
