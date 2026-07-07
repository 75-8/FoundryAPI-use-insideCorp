targetScope = 'resourceGroup'

param foundryAccountName string
param principalId string
param storageAccountName string
param funcAuditPrincipalId string

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' existing = {
  name: foundryAccountName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

var cognitiveServicesOpenAIUserId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
var storageBlobDataContributorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var storageQueueDataContributorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88')

resource foundryUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: foundryAccount
  name: guid(foundryAccount.id, principalId, cognitiveServicesOpenAIUserId)
  properties: {
    roleDefinitionId: cognitiveServicesOpenAIUserId
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

resource apimQueueAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, principalId, storageQueueDataContributorId, 'apim')
  properties: {
    roleDefinitionId: storageQueueDataContributorId
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

resource functionBlobAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, funcAuditPrincipalId, storageBlobDataContributorId)
  properties: {
    roleDefinitionId: storageBlobDataContributorId
    principalId: funcAuditPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource functionQueueAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, funcAuditPrincipalId, storageQueueDataContributorId)
  properties: {
    roleDefinitionId: storageQueueDataContributorId
    principalId: funcAuditPrincipalId
    principalType: 'ServicePrincipal'
  }
}
