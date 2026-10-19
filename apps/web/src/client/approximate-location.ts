import { LatLng } from "@savour/core/contracts";
import { Effect, Schema } from "effect";

export const Located = Schema.TaggedStruct("Located", { near: LatLng });

export const LocationOff = Schema.TaggedStruct("LocationOff", {});

export type LocationOutcome = typeof Located.Type | typeof LocationOff.Type;

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 600_000,
  timeout: 10_000,
};

const toKilometre = (degrees: number) => Math.round(degrees * 100) / 100;

export const approximateLocation: Effect.Effect<LocationOutcome> =
  Effect.callback((resume) => {
    if (!("geolocation" in navigator)) {
      resume(Effect.succeed(LocationOff.make({})));

      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resume(
          Effect.succeed(
            Located.make({
              near: {
                latitude: toKilometre(coords.latitude),
                longitude: toKilometre(coords.longitude),
              },
            })
          )
        );
      },
      () => {
        resume(Effect.succeed(LocationOff.make({})));
      },
      POSITION_OPTIONS
    );
  });
