# Azure Functions implementation

The deployable TypeScript Functions live in `log-batch`:

- `auditQueue`: queue-triggered ingestion from the APIM audit queue into sanitized analytics JSON blobs.
- `auditBatch`: timer-triggered conversion from analytics JSON blobs to Parquet archive blobs.

This directory is kept to match the infrastructure specification layout and to point operators to the deployable package.
