import { DatabaseUnavailable, ReviewLikes, VisitNotFound } from "@savour/core";
import type { LikeTally } from "@savour/core";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Effect, Layer, Schema } from "effect";

import { reviewLikes, visits } from "./schema.js";

const isVisitId = Schema.is(Schema.String.check(Schema.isUUID()));

const unavailable =
  (event: string) =>
  <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.tapError((failure) =>
        Effect.logError(event).pipe(
          Effect.annotateLogs({ reason: failure._tag })
        )
      ),
      Effect.mapError(() => new DatabaseUnavailable({ reason: "unreachable" }))
    );

export const PostgresReviewLikes = Layer.effect(
  ReviewLikes,
  Effect.gen(function* makePostgresReviewLikes() {
    const db = yield* PgDrizzle.makeWithDefaults();

    return ReviewLikes.of({
      like: (accountId, visitId) =>
        db
          .insert(reviewLikes)
          .values({ accountId, visitId })
          .onConflictDoNothing()
          .pipe(unavailable("review.like_failed"), Effect.asVoid),
      likeTarget: (visitId) =>
        (isVisitId(visitId)
          ? db
              .select({ authorId: visits.accountId, review: visits.review })
              .from(visits)
              .where(eq(visits.id, visitId))
              .pipe(unavailable("review.read_failed"))
          : Effect.succeed([])
        ).pipe(
          Effect.flatMap(([row]) =>
            row === undefined
              ? Effect.fail(new VisitNotFound({ visitId }))
              : Effect.succeed({
                  authorId: row.authorId,
                  hasReview: row.review !== null,
                })
          )
        ),
      tallies: (accountId, visitIds) =>
        visitIds.length === 0
          ? Effect.succeed(new Map<string, LikeTally>())
          : db
              .select({
                likeCount: count(),
                likedByMe: sql<boolean>`bool_or(${reviewLikes.accountId} = ${accountId})`,
                visitId: reviewLikes.visitId,
              })
              .from(reviewLikes)
              .where(inArray(reviewLikes.visitId, [...visitIds]))
              .groupBy(reviewLikes.visitId)
              .pipe(
                unavailable("review.tally_failed"),
                Effect.map(
                  (rows) =>
                    new Map(
                      rows.map(({ likeCount, likedByMe, visitId }) => [
                        visitId,
                        { likeCount, likedByMe },
                      ])
                    )
                )
              ),
      unlike: (accountId, visitId) =>
        db
          .delete(reviewLikes)
          .where(
            and(
              eq(reviewLikes.accountId, accountId),
              eq(reviewLikes.visitId, visitId)
            )
          )
          .pipe(unavailable("review.unlike_failed"), Effect.asVoid),
    });
  })
);
