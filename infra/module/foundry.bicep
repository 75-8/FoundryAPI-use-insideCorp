targetScope = 'resourceGroup'

param location string
param foundryName string
param modelName string = 'gpt-5.4'
param modelCapacity int = 30000

// Azure AI Foundry (Cognitive Services Account)
resource foundryAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: foundryName
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'AIServices' // Foundry向け統合リソース
  properties: {
    customSubDomainName: foundryName
    publicNetworkAccess: 'Enabled' // Managed Identity + APIMからアクセスするためEnabled（MIからの接続でもpublic endpointを使用する場合があるため。SEC-001としてMIのみ許可するRBACを設定する）
    disableLocalAuth: true // SEC-003: API Key を無効化
  }
}

// Model Deployment
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  parent: foundryAccount
  name: modelName
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: '1' // バージョンは環境により調整
    }
    scaleSettings: {
      scaleType: 'Standard'
      capacity: modelCapacity / 1000 // capacity は 1K TPM 単位
    }
  }
}

output foundryEndpoint string = foundryAccount.properties.endpoint
output foundryId string = foundryAccount.id
output foundryName string = foundryAccount.name
output modelDeploymentName string = modelDeployment.name
