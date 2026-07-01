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
        json: '# Azure OpenAI 利用監査ダッシュボード\nAPIMおよびAzure Functionsのログから取得したLLMの利用統計情報です。'
      }
      name: 'title'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'AppTraces\n| extend msg = parse_json(message)\n| where isnotnull(msg.timestamp) and isnotnull(msg.requestId)\n| extend StatusCode = toint(msg.statusCode)\n| summarize TotalRequests = count(), ErrorRequests = countif(StatusCode >= 400)\n| extend SuccessRate = round(todouble(TotalRequests - ErrorRequests) * 100.0 / TotalRequests, 2)\n| project TotalRequests, ErrorRequests, SuccessRate = strcat(SuccessRate, "%")'
        size: 4
        title: '全体の概要統計 (リクエスト数 / エラー数 / 成功率)'
        queryType: 0
        resourceType: 'microsoft.insights/components'
      }
      name: 'overall_stats'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'AppTraces\n| extend msg = parse_json(message)\n| where isnotnull(msg.timestamp) and isnotnull(msg.requestId)\n| extend Timestamp = todatetime(msg.timestamp),\n         TotalTokens = toint(msg.totalTokens)\n| summarize TotalTokens = sum(TotalTokens) by bin(Timestamp, 1d)\n| order by Timestamp asc'
        size: 0
        title: '日次 Token 利用推移'
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'timechart'
      }
      name: 'daily_token_usage'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'AppTraces\n| extend msg = parse_json(message)\n| where isnotnull(msg.timestamp) and isnotnull(msg.requestId)\n| extend OID = tostring(msg.oid),\n         TotalTokens = toint(msg.totalTokens)\n| summarize TotalUsage = sum(TotalTokens) by OID\n| order by TotalUsage desc'
        size: 0
        title: 'ユーザー別 (OID) 累積 Token 利用量'
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'table'
      }
      name: 'usage_by_user'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'AppTraces\n| extend msg = parse_json(message)\n| where isnotnull(msg.timestamp) and isnotnull(msg.requestId)\n| extend Model = tostring(msg.model),\n         TotalTokens = toint(msg.totalTokens)\n| summarize TotalUsage = sum(TotalTokens) by Model\n| order by TotalUsage desc'
        size: 0
        title: 'モデル別利用比率'
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'piechart'
      }
      name: 'usage_by_model'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'AppTraces\n| extend msg = parse_json(message)\n| where isnotnull(msg.timestamp) and isnotnull(msg.requestId)\n| extend ResponseTimeMs = toint(msg.responseTimeMs)\n| summarize Avg = avg(ResponseTimeMs), P50 = percentile(ResponseTimeMs, 50), P90 = percentile(ResponseTimeMs, 90), P99 = percentile(ResponseTimeMs, 99)'
        size: 4
        title: '応答速度分析 (ミリ秒)'
        queryType: 0
        resourceType: 'microsoft.insights/components'
      }
      name: 'latency_stats'
    }
    {
      type: 3
      content: {
        version: 'KqlItem/1.0'
        query: 'AppTraces\n| extend msg = parse_json(message)\n| where isnotnull(msg.timestamp) and isnotnull(msg.requestId)\n| extend OID = tostring(msg.oid),\n         TotalTokens = toint(msg.totalTokens)\n| summarize TotalUsage = sum(TotalTokens), RequestCount = count() by OID\n| order by TotalUsage desc\n| limit 10'
        size: 0
        title: 'Top 利用者 (上位 10 名)'
        queryType: 0
        resourceType: 'microsoft.insights/components'
        visualization: 'table'
      }
      name: 'top_users'
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
