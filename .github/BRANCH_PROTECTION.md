# Branch protection recommendation

Recommended baseline for the default branch:

1. Require changes through pull requests.
2. Require at least one approval and dismiss stale approvals after new commits.
3. Require all review conversations to be resolved.
4. Block force pushes and branch deletion.
5. Limit bypass access to an explicit break-glass owner path.
6. Add required status checks only when the repository has a stable, meaningful check; do not add placeholder CI.
7. Review signed commits, merge queue, and organization rulesets after the team and release process are defined.

This file documents the recommendation. It does not claim that GitHub branch protection is enabled.
