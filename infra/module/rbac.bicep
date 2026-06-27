targetScope = 'resourceGroup'

param foundryAccountName string
param principalId string

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' existing = {
  name: foundryAccountName
}

// Cognitive Services OpenAI User role (5e0bd9bd-7b93-4f28-af87-19fc36ad61bd)
var roleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: foundryAccount
  name: guid(foundryAccount.id, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: roleDefinitionId
    principalId: principalId
    principalType: 'ServicePrincipal' // Managed Identity
  }
}
