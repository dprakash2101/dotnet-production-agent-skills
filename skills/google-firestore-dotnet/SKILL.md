---
name: google-firestore-dotnet
description: Implement or review Google Cloud Firestore persistence in .NET. Use only for Google.Cloud.Firestore document models, reads/writes, queries, transactions, batches, indexes, or Firestore cost/modeling decisions.
---

# Google Cloud Firestore for .NET

Follow the repository's data-access boundary and installed `Google.Cloud.Firestore` version. Create/reuse `FirestoreDb` through established DI/configuration. Use Application Default Credentials and deployed workload/service identities; never commit service-account keys.

Model for document access patterns, not relational normalization. Choose collection/document boundaries, denormalization, document size/growth, consistency needs, and update frequency from the reads and writes the application actually performs. Avoid joins simulated through many serial reads.

- Use stable, collision-safe document IDs. Do not place secrets or unnecessary PII in IDs or paths; IDs appear in logs and operational tooling.
- Use explicit serialization attributes/converters where domain and stored representations differ. Treat missing fields, nulls, server timestamps, numeric types, and schema evolution deliberately.
- Fetch only required documents and avoid read-before-write when a precondition, transaction, atomic transform, or direct write can enforce the requirement. Firestore charges and latency are affected by unnecessary reads.
- Use transactions for read-dependent atomic decisions and expect the callback may execute more than once. Keep transaction code deterministic and free of non-idempotent external side effects. Use batched writes for atomic write-only groups.
- Apply update-time/precondition checks where lost updates matter. Bound concurrency and do not share mutable model state between operations.
- Use indexed, bounded queries with cursors for pagination. Avoid offsets for large scans, unbounded collection reads, and query shapes that require accidental fan-out. Treat missing-index errors as a schema/deployment decision, not a reason to bypass safe queries.
- Propagate cancellation where the client API supports it. Classify cancellation, permission, precondition/conflict, quota/transient, invalid-data, and permanent failures without swallowing them.
- Log operation, collection, safe document/correlation identifiers, latency, and outcome; do not log full documents or sensitive field values by default.

Do not add custom retries merely because failures can be transient. Add them only when explicitly requested or required by existing architecture, and prefer client-supported behavior. Before retrying, account for transaction callback reruns, write idempotency, preconditions, duplicate side effects, timeout budget, bounded attempts, cancellation, and permanent error classification.

Test serialization compatibility, absent/null fields, transaction reruns, concurrency preconditions, pagination, and cost-significant query behavior when applicable.
