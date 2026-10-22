#!/usr/bin/env bash
set -euo pipefail

api="${STAGING_API_URL:?STAGING_API_URL is required}"
run="${GITHUB_RUN_ID:-$(date +%s)}"
handle="smoke_${run}"
email="smoke+${run}@example.test"
password="correct horse 9"

expect_status() {
  local name="$1" expected="$2" actual="$3"

  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL ${name}: expected ${expected}, got ${actual}" >&2
    exit 1
  fi

  echo "ok   ${name} (${actual})"
}

status() {
  curl --silent --output /dev/null --write-out '%{http_code}' --max-time 20 "$@"
}

json() {
  printf '{"email":"%s","handle":"%s","password":"%s"}' "$1" "$2" "$3"
}

post_json() {
  status --request POST "${api}$1" --header 'content-type: application/json' --data "$2"
}

expect_status "database health" 200 "$(status "${api}/health/database")"

signup="$(curl --silent --max-time 20 --request POST "${api}/accounts" \
  --header 'content-type: application/json' \
  --data "$(json "$email" "$handle" "$password")")"
token="$(printf '%s' "$signup" | sed -nE 's/.*"token":"([^"]+)".*/\1/p')"

if [[ -z "$token" ]]; then
  echo "FAIL sign up: no session token in the answer" >&2
  exit 1
fi

echo "ok   sign up"

expect_status "current account" 200 \
  "$(status "${api}/account" --header "authorization: Bearer ${token}")"
place_id="$(curl --silent --get --max-time 20 "${api}/restaurants/search" \
  --data-urlencode "q=pizzaria bragança paulista" |
  grep -o '"placeId":"[^"]*"' | head -n 1 | cut -d '"' -f 4)"

if [[ -z "$place_id" ]]; then
  echo "FAIL restaurant search: no place to log a visit to" >&2
  exit 1
fi

visit_id="$(curl --silent --max-time 20 --request POST "${api}/visits" \
  --header "authorization: Bearer ${token}" --header 'content-type: application/json' \
  --data "$(printf '{"placeId":"%s","date":"%s","rating":4}' "$place_id" "$(date -u +%F)")" |
  grep -o '"id":"[^"]*"' | head -n 1 | cut -d '"' -f 4)"

if [[ -z "$visit_id" ]]; then
  echo "FAIL log a visit: no visit id in the answer" >&2
  exit 1
fi

echo "ok   log a visit"

expect_status "edit a visit" 200 \
  "$(status --request PATCH "${api}/visits/${visit_id}" --header "authorization: Bearer ${token}" \
    --header 'content-type: application/json' --data '{"rating":4.5}')"
expect_status "search the diary" 200 \
  "$(status --get "${api}/diary" --data-urlencode "q=pizza" --header "authorization: Bearer ${token}")"
expect_status "delete a visit" 200 \
  "$(status --request DELETE "${api}/visits/${visit_id}" --header "authorization: Bearer ${token}")"
expect_status "deleted visit" 404 \
  "$(status --request DELETE "${api}/visits/${visit_id}" --header "authorization: Bearer ${token}")"
expect_status "diary" 200 \
  "$(status "${api}/diary" --header "authorization: Bearer ${token}")"
restaurant_id="$(curl --silent --max-time 20 --request POST "${api}/want-to-go" \
  --header "authorization: Bearer ${token}" --header 'content-type: application/json' \
  --data "$(printf '{"placeId":"%s"}' "$place_id")" |
  grep -o '"id":"[^"]*"' | head -n 1 | cut -d '"' -f 4)"

if [[ -z "$restaurant_id" ]]; then
  echo "FAIL add to want-to-go: no restaurant id in the answer" >&2
  exit 1
fi

echo "ok   add to want-to-go"

expect_status "want-to-go list" 200 \
  "$(status "${api}/want-to-go" --header "authorization: Bearer ${token}")"
expect_status "remove from want-to-go" 200 \
  "$(status --request DELETE "${api}/want-to-go/${restaurant_id}" --header "authorization: Bearer ${token}")"
expect_status "duplicate handle" 409 \
  "$(post_json /accounts "$(json "other+${run}@example.test" "$handle" "$password")")"
expect_status "wrong password" 401 \
  "$(post_json /sessions "$(printf '{"email":"%s","password":"wrong"}' "$email")")"
expect_status "sign out" 200 \
  "$(status --request DELETE "${api}/sessions/current" --header "authorization: Bearer ${token}")"
expect_status "signed out" 401 \
  "$(status "${api}/account" --header "authorization: Bearer ${token}")"
expect_status "restaurant search" 200 \
  "$(status --get "${api}/restaurants/search" --data-urlencode "q=pizzaria bragança paulista")"
