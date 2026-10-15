# Labels

Maps label roles to this repo's real GitHub labels. Category roles map to GitHub's default labels.

The state and chaos labels don't exist in the repo yet. Create them on GitHub before the pipeline applies them, because skills never create labels themselves. No CI workflow enforces labels.

```
ready-for-agent:  ready-for-agent     # missing in repo
in-progress:      in-progress         # missing in repo
in-review:        in-review           # missing in repo
needs-human:      needs-human         # missing in repo
category:feature: enhancement
category:fix:     bug
chaos:passed:     chaos:passed        # missing in repo
chaos:found-bugs: chaos:found-bugs    # missing in repo
required:         []
```
