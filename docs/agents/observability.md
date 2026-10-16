# Observability

Logs go through Effect's structured logger (`Effect.log*` with `Effect.annotateLogs`). Cloudflare Workers logs are the only place logs end up. There is no request-event pipeline, dashboard or alert yet. Adding one is a card of its own.

```
platform: none                 # Cloudflare Workers logs only
logger: effect                 # Effect structured logger (Effect.log*)
request_events: none
event_naming: <entity>.<past_tense_verb>   # e.g. visit.logged, follow.created
dashboards: none
alerts: none
```
