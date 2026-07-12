# APIM Log Pipeline Functions

Azure Functions v4 / TypeScript / Node.js 20 implementation for the APIM - Azure AI Foundry communication log collection pipeline described in `docs/spec/spec_function.md`.

## Functions

- `ingestLog`: Timer Trigger that uses byte-offset cursors and Range Download to read appended APIM Diagnostic JSON Lines without relying on Blob Trigger receipts.
- `processQueue`: Storage Queue Trigger that writes deterministic Analytics JSON first, then sends the record to Log Analytics.
- `poisonHandler`: Storage Queue Trigger for the built-in `buffer-poison` queue that persists failed messages to Poison Blob and emits structured Application Insights error logs.
- `archiveDaily`: Timer Trigger that aggregates the previous UTC day's Analytics JSON into one Archive-tier Parquet file.

## Parquet library selection

This project uses `@dsnp/parquetjs` `^1.5.0` for Archive Parquet generation.

Selection rationale:

- It provides TypeScript-compatible APIs for defining schemas and writing Parquet files from Node.js 20 code.
- It avoids adding a Python, JVM, or native service dependency to the Consumption-plan Function App.
- The implementation writes a temporary Parquet file and uploads the resulting buffer with `BlockBlobClient.upload(..., { tier: 'Archive' })`, because the Azure Storage SDK convenience methods do not support specifying Archive tier at upload time.

Archive blobs are offline after upload and are intended for evidence retention only. Dashboards and routine analysis should use Hot-tier Analytics JSON or Log Analytics instead.
