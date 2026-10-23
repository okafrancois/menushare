`convex-test@0.0.60.patch` adds the Convex 1.48 `1.0/storageGet`
mutation syscall using the emulator's existing blob map and transactional
`_storage` documents. It also records the uploaded Blob's content type (as
upstream convex-test 0.0.65 does), so tests use actual files without casting
system-table writes.

Neither 0.0.60 nor 0.0.65 implements the new storage syscall. The existing
0.0.60 version is retained: 0.0.65 also changes mocked-clock behavior in three
existing analytics/service tests. This patch does not emulate file transaction
budgets or establish hosted runtime compatibility. Remove it once an upstream
release supports the syscall and passes the existing suite.
