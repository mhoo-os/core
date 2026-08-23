# Runtime Example

## Worker Handler

```ts
const handler = async (tenantId: string) => {
  await withTenantTransaction(pool, tenantId, async (transaction) => {
    await transaction.query('select current_setting(\'app.current_tenant_id\', true)');
  });
};
```

The parser must not mistake the `#` character in a fenced code sample for a
Markdown heading.

```sh
# this is a shell comment, not a document heading
pnpm phase0c:evaluate
```
