# Observability

Follows the rat-stack conventions. Logs go through Effect's structured logger. `packages/events` records one event per HTTP request through the `EventSink` port (`withEventCapture`). Cloudflare Workers logs are the only place logs end up. No dashboards or alerts exist yet.

```
platform: none                 # Cloudflare Workers logs only
logger: effect                 # Effect structured logger (Effect.log*)
request_events: packages/events withEventCapture → EventSink
event_naming: <entity>.<past_tense_verb>   # e.g. visit.logged, follow.created
dashboards: none
alerts: none
```
