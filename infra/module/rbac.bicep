targetScope = 'resourceGroup'

param foundryAccountName string
param principalId string // APIM Managed Identity

param storageAccountName string
param funcAppPrincipalId string

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' existing = {
  name: foundryAccountName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

// Cognitive Services OpenAI User role (5e0bd9bd-7b93-4f28-af87-19fc36ad61bd)
var roleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: foundryAccount
  name: guid(foundryAccount.id, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: roleDefinitionId
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Role Definitions for Storage Account
var storageBlobDataOwnerId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b7e6dc21-b1e4-47ef-941f-11b17200725a')
var storageQueueDataContributorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88')
var storageTableDataContributorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1e-b9d0-4c7e-9187-d00e2c21290a')

// Assign Storage Blob Data Owner to the Function App identity
resource blobOwnerAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, funcAppPrincipalId, storageBlobDataOwnerId)
  properties: {
    roleDefinitionId: storageBlobDataOwnerId
    principalId: funcAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Storage Queue Data Contributor to the Function App identity
resource queueContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, funcAppPrincipalId, storageQueueDataContributorId)
  properties: {
    roleDefinitionId: storageQueueDataContributorId
    principalId: funcAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Storage Table Data Contributor to the Function App identity
resource tableContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, funcAppPrincipalId, storageTableDataContributorId)
  properties: {
    roleDefinitionId: storageTableDataContributorId
    principalId: funcAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

