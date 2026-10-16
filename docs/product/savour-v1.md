# Savour v1 — a Letterboxd for restaurants

## Problem

People who eat out a lot forget where they went, what they ordered and whether it was any good. General review platforms (Google Maps, Yelp, TripAdvisor) give anonymous averages instead of opinions from people whose taste you know. Letterboxd solved this for films by combining a personal diary with a social graph of people you follow. Restaurants have no equivalent. Savour aims to stay as close to Letterboxd as possible: logging comes first, and social features build on it.

Evidence: the founder's own need and their friends'. No external research yet.

## Who it's for

The founder and their circle of friends, based in **Bragança Paulista** and **São Paulo** (Brazil). They eat out regularly and want to keep a record of it and see where their friends have been. Sign-up is open to anyone, but v1 is seeded with and measured against this cohort.

## Success criteria

- At least **5 friends** are active on Savour.
- At least **60% of them log 1 or more visits in each of 4 consecutive weeks** after onboarding.

## Scope

### In

- **Accounts**: open sign-up for anyone with the link, plus a public profile.
- **Restaurant catalog**: search restaurants from an external places provider. Search works anywhere the provider has coverage. If a place is missing, the user can add it.
- **User-added restaurants**: visible to everyone straight away and marked "added by a user". Anyone can report one as a duplicate or wrong.
- **Admin view** (founder only): see reports, merge a duplicate into the real place, remove a bad entry.
- **Logging a visit** (diary entry): visit date (no time of day), rating from 0.5 to 5 in half-star steps, a "loved it" heart, an optional written review, free-text tags, free-text dish tags (what was ordered), and a revisit flag.
- **Revisits**: every visit keeps its own rating in the diary. A user's current rating for a restaurant is the rating of their most recent visit.
- **Diary**: a reverse-chronological list of your visits, searchable by tags and dish tags.
- **Want-to-go list**: save restaurants you plan to visit, and remove them.
- **Follow**: one-way follows with no approval, like Letterboxd.
- **Activity feed**: logs and reviews from the people you follow.
- **Likes on reviews**: users can like other users' reviews.
- **Restaurant page**: name, address, cuisine and price level from the provider. The Savour average rating and rating histogram. Reviews from people you follow shown first, then everyone else's. Actions: log a visit, add to want-to-go.
- **Profile**: top-4 favourite restaurants, visit count, rating histogram, diary, and want-to-go list. Everything is public.
- **Platform**: a mobile-first responsive web app.

### Out

- Lists (named, shareable or ranked lists of restaurants).
- Comments on reviews or logs.
- Photos of any kind.
- Private profiles and follow requests.
- Exact visit times and live check-ins.
- A shared dish catalog, or per-restaurant dish aggregates ("most ordered", "best-rated dish").
- Sub-ratings (food, service, ambience), price paid, who you went with.
- Invite-only access or invite codes.
- Native iOS/Android apps.
- Limiting search to a geographic area.
- Automatic hiding or moderation of reported places.

## Acceptance criteria

- **Search a restaurant**
  - Given a signed-in user, when they search for a restaurant that exists in Bragança Paulista or São Paulo, then it appears in the results with its name and address.
  - Given a restaurant outside those cities that the provider covers, when the user searches for it, then it also appears.
- **Add a missing restaurant**
  - Given a search with no match, when the user adds the restaurant with a name and address, then it can be logged straight away, is visible to other users, and is marked "added by a user".
- **Report and fix a user-added restaurant**
  - Given a user-added restaurant, when any user reports it as a duplicate or wrong, then the report appears in the founder's admin view.
  - Given a duplicate report, when the founder merges it into the original, then the logs of both places end up on the original and the duplicate stops appearing in search.
  - Given a wrong entry, when the founder removes it, then it stops appearing in search.
- **Log a visit**
  - Given a restaurant, when the user logs a visit with a date and a rating, then the visit appears at the top of their diary with the date and rating they entered.
  - The rating accepts only values from 0.5 to 5 in steps of 0.5.
  - A log can be saved with just a date (rating, heart, review, tags and dishes are all optional).
  - A log never stores or shows a time of day.
- **Revisit**
  - Given visits rated 3.5, 4 and 4.5 (in that order), the user's current rating for that restaurant is 4.5, and all three visits stay in the diary with their own ratings.
- **Want-to-go**
  - When a user adds a restaurant to want-to-go, it appears on their want-to-go list and profile. When they remove it, it disappears.
- **Follow and feed**
  - When user A follows user B, there's no approval step, and B's next log appears in A's feed.
  - When A unfollows B, B's new logs no longer appear in A's feed.
- **Like a review**
  - When a user likes someone else's review, the review's like count goes up by one. Liking it again does not add a second like, and unliking removes it.
- **Restaurant page**
  - It shows the Savour average rating and histogram across all users' current ratings.
  - Reviews from people the viewer follows are listed before everyone else's.
- **Profile**
  - Any visitor, signed in or not, can see a user's top-4 favourites, visit count, rating histogram, diary and want-to-go list.
- **Mobile web**
  - Every flow above can be completed in a phone browser.

## Constraints & dependencies

- Depends on an **external places provider** for search and restaurant details (name, address, cuisine, price level). Its coverage of Bragança Paulista determines whether users can find the places they go to. The provider's terms of use may limit what data can be stored or shown.
- All profile and visit data is public, so the "date only, no time" rule is the main privacy protection. It must hold in every view and export.
- The admin role is a single person (the founder).
- The cohort is small, so the Savour averages on restaurant pages will be based on very few ratings for a long time.

## Open questions

| Question | Owner | Status |
| --- | --- | --- |
| Which places provider (Google Places, Foursquare, OpenStreetMap, …), and does its coverage of Bragança Paulista meet the search acceptance criteria? | Tech lead — provider choice | Open |
| Which sign-in method (email + password, magic link, Google, …)? | Founder — onboarding experience | Open |
| Account deletion and data export: needed for v1, given that profiles are public and Brazil's data-protection law (LGPD) applies? | Founder — legal/privacy | Open |
| How are the top-4 favourites chosen: picked by the user, or derived from ratings? | Founder — product | Open |
| Should the restaurant-page average have a minimum number of ratings before it is shown? | Founder — product | Open |
| How is the success metric measured (analytics event vs. a database query)? | Tech lead — instrumentation | Open |
