import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import { CannotLikeOwnReview } from "./cannot-like-own-review.js";
import { DatabaseUnavailable } from "./database-health-contracts.js";
import { NextAction } from "./health-contracts.js";
import { NotAReview } from "./not-a-review.js";
import { Unauthenticated } from "./unauthenticated.js";
import { VisitNotFound } from "./visit-not-found.js";

export const LikeCount = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const LikedReview = Schema.Struct({
  likeCount: LikeCount,
  likedByMe: Schema.Boolean,
  next: Schema.Array(NextAction),
  visitId: Schema.String,
});

export const likeReviewContract = defineContract("likeReview", {
  annotations: { idempotent: true },
  description:
    "Like someone else's review, the visit with that `id`, with the bearer token. Liking it again keeps one like. Only a visit with review text can be liked, and never your own.",
  failure: Schema.Union([
    Unauthenticated,
    VisitNotFound,
    NotAReview,
    CannotLikeOwnReview,
    DatabaseUnavailable,
  ]),
  http: { method: "PUT", path: "/visits/:id/like" },
  input: Schema.Struct({ id: Schema.String }),
  output: LikedReview,
});

export const unlikeReviewContract = defineContract("unlikeReview", {
  annotations: { idempotent: true },
  description:
    "Take back your like on the review of the visit with that `id`, with the bearer token. Unliking a review you never liked changes nothing.",
  failure: Schema.Union([Unauthenticated, VisitNotFound, DatabaseUnavailable]),
  http: { method: "DELETE", path: "/visits/:id/like" },
  input: Schema.Struct({ id: Schema.String }),
  output: LikedReview,
});
