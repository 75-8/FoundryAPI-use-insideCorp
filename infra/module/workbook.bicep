targetScope = 'resourceGroup'

param location string
param workbookName string
param logAnalyticsWorkspaceId string

var workbookContent = {
  version: 'Notebook/1.0'
  items: [
    {
      type: 1
      content: {
        json: '## Azure AI Coding Agent Usage Dashboard\nThis dashboard shows the usage of the AI Coding Agent based on API Management logs.'
      }
      name: 'title'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'AppTraces\n| where message has "llm-api-call"\n| extend msg = parse_json(message)\n| extend TotalTokens = toint(msg.totalTokens)\n| extend UPN = tostring(msg.upn)\n| extend OID = tostring(msg.oid)\n| summarize TotalUsage = sum(TotalTokens) by UPN, OID\n| order by TotalUsage desc'
        size: 0
        title: 'Token Usage by User'
        timeContext: {
          durationMs: 86400000 // 24 hours
        }
        queryType: 0
        resourceType: 'microsoft.insights/components'
      }
      name: 'usage_by_user'
    }
  ]
  isLocked: false
  fallbackResourceIds: [
    logAnalyticsWorkspaceId
  ]
}

resource workbook 'Microsoft.Insights/workbooks@2022-04-01' = {
  name: guid(resourceGroup().id, workbookName)
  location: location
  kind: 'shared'
  properties: {
    displayName: workbookName
    serializedData: string(workbookContent)
    sourceId: logAnalyticsWorkspaceId
    category: 'workbook'
  }
}
