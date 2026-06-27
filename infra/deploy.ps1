<#
.SYNOPSIS
    Azure AI Coding Agent Platform のデプロイスクリプト

.DESCRIPTION
    このスクリプトは、指定された環境(dev等)向けにBicepをデプロイします。
    事前に `az login` を実行しておく必要があります。

.EXAMPLE
    .\deploy.ps1
    デフォルトで dev 環境へデプロイします。

.EXAMPLE
    .\deploy.ps1 -Environment "dev"
#>

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev")]
    [string]$Environment = "dev",

    [Parameter(Mandatory=$false)]
    [string]$Location = "japaneast"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path $MyInvocation.MyCommand.Path
$MainBicep = Join-Path $ScriptDir "main.bicep"
$ParamFile = Join-Path $ScriptDir "parameters\$Environment.bicepparam"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Azure AI Coding Agent Platform Deploy" -ForegroundColor Cyan
Write-Host " Environment: $Environment" -ForegroundColor Cyan
Write-Host " Location:    $Location" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if az CLI is logged in
$account = az account show --query "name" -o tsv
if (-not $account) {
    Write-Host "Please login to Azure using 'az login'" -ForegroundColor Red
    exit 1
}
Write-Host "Subscription: $account" -ForegroundColor Green

# 1. Lint
Write-Host "`n[1/3] Running Bicep Lint..." -ForegroundColor Cyan
az bicep lint --file $MainBicep
if ($LASTEXITCODE -ne 0) {
    Write-Host "Lint failed." -ForegroundColor Red
    exit 1
}
Write-Host "Lint passed successfully." -ForegroundColor Green

# 2. What-If (Preview)
Write-Host "`n[2/3] Running What-If (Preview)..." -ForegroundColor Cyan
az deployment sub what-if `
    --name "deploy-foundry-$Environment" `
    --location $Location `
    --template-file $MainBicep `
    --parameters $ParamFile

$confirmation = Read-Host "`nDo you want to proceed with the deployment? (y/N)"
if ($confirmation -notmatch "^[yY](es)?$") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

# 3. Deploy
Write-Host "`n[3/3] Deploying..." -ForegroundColor Cyan
$deployment = az deployment sub create `
    --name "deploy-foundry-$Environment" `
    --location $Location `
    --template-file $MainBicep `
    --parameters $ParamFile `
    --output json | ConvertFrom-Json

if ($deployment.properties.provisioningState -eq "Succeeded") {
    Write-Host "`nDeployment Succeeded!" -ForegroundColor Green
    $gatewayUrl = $deployment.properties.outputs.apimGatewayUrl.value
    Write-Host "APIM Gateway URL: $gatewayUrl" -ForegroundColor Green
} else {
    Write-Host "`nDeployment Failed or Canceled." -ForegroundColor Red
}
