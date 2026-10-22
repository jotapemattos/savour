import { implement } from "@savour/capability/implement";
import { Effect } from "effect";

import { CannotLikeOwnReview } from "./cannot-like-own-review.js";
import { NotAReview } from "./not-a-review.js";
import {
  likeReviewContract,
  unlikeReviewContract,
} from "./review-like-contracts.js";
import { ReviewLikes, noLikes } from "./review-likes.js";
import { signedInAccountId } from "./visit-capabilities.js";

export const likeReviewAction = {
  description:
    "Like someone else's review with `PUT /visits/{id}/like` and the bearer token.",
  href: "/visits/{id}/like",
  rel: "like",
} as const;

export const unlikeReviewAction = {
  description:
    "Take your like back with `DELETE /visits/{id}/like` and the bearer token.",
  href: "/visits/{id}/like",
  rel: "unlike",
} as const;

const tallyOf = (accountId: string, visitId: string) =>
  ReviewLikes.use((likes) => likes.tallies(accountId, [visitId])).pipe(
    Effect.map((tallies) => tallies.get(visitId) ?? noLikes)
  );

export const likeReview = implement(likeReviewContract, ({ id }) =>
  Effect.gen(function* likeAReview() {
    const accountId = yield* signedInAccountId;
    const likes = yield* ReviewLikes;
    const target = yield* likes.likeTarget(id);

    if (!target.hasReview) {
      return yield* new NotAReview({ visitId: id });
    }

    if (target.authorId === accountId) {
      return yield* new CannotLikeOwnReview({ visitId: id });
    }

    yield* likes.like(accountId, id);

    yield* Effect.logInfo("review.liked").pipe(
      Effect.annotateLogs({ visitId: id })
    );

    const tally = yield* tallyOf(accountId, id);

    return { ...tally, next: [unlikeReviewAction], visitId: id };
  })
);

export const unlikeReview = implement(unlikeReviewContract, ({ id }) =>
  Effect.gen(function* unlikeAReview() {
    const accountId = yield* signedInAccountId;
    const likes = yield* ReviewLikes;

    yield* likes.likeTarget(id);
    yield* likes.unlike(accountId, id);

    yield* Effect.logInfo("review.unliked").pipe(
      Effect.annotateLogs({ visitId: id })
    );

    const tally = yield* tallyOf(accountId, id);

    return { ...tally, next: [likeReviewAction], visitId: id };
  })
);
