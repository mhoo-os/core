# Release Checklist

## Checks

- verify deterministic output
- preserve metadata
- keep the adapter removable

| Gate | Expected |
| --- | --- |
| Offline | PASS |
| Persistence | none |

### Notes

> A fixture is not an external source.

1. Read local Markdown.
2. Transform it.
3. Return plain canonical chunks.
