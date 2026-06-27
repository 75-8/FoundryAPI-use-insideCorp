targetScope = 'resourceGroup'

param location string
param identityName string

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

output principalId string = managedIdentity.properties.principalId
output clientId string = managedIdentity.properties.clientId
output resourceId string = managedIdentity.id
