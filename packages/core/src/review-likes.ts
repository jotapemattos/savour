import { Context } from "effect";
import type { Effect } from "effect";

import type { DatabaseUnavailable } from "./database-health-contracts.js";
import type { VisitNotFound } from "./visit-not-found.js";

export interface LikeTarget {
  readonly authorId: string;
  readonly hasReview: boolean;
}

export interface LikeTally {
  readonly likeCount: number;
  readonly likedByMe: boolean;
}

export const noLikes: LikeTally = { likeCount: 0, likedByMe: false };

export interface ReviewLikesService {
  readonly like: (
    accountId: string,
    visitId: string
  ) => Effect.Effect<void, DatabaseUnavailable>;
  readonly likeTarget: (
    visitId: string
  ) => Effect.Effect<LikeTarget, VisitNotFound | DatabaseUnavailable>;
  readonly tallies: (
    accountId: string,
    visitIds: readonly string[]
  ) => Effect.Effect<ReadonlyMap<string, LikeTally>, DatabaseUnavailable>;
  readonly unlike: (
    accountId: string,
    visitId: string
  ) => Effect.Effect<void, DatabaseUnavailable>;
}

export class ReviewLikes extends Context.Service<
  ReviewLikes,
  ReviewLikesService
>()("@savour/core/ReviewLikes") {}
