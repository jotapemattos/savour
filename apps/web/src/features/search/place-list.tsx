import type { Place } from "@savour/core/contracts";
import { motion, useReducedMotion } from "motion/react";

const PRICE_LABELS = [
  "Free",
  "Inexpensive",
  "Moderately priced",
  "Expensive",
  "Very expensive",
] as const;

const ENTER_EASE = [0.23, 1, 0.32, 1] as const;

const STAGGER_SECONDS = 0.04;

const STAGGERED_ITEMS = 6;

const PriceMarks = (props: { readonly level: 0 | 1 | 2 | 3 | 4 }) =>
  props.level === 0 ? (
    <span>{PRICE_LABELS[0]}</span>
  ) : (
    <span>
      <span aria-hidden="true">{"$".repeat(props.level)}</span>
      <span className="sr-only">{PRICE_LABELS[props.level]}</span>
    </span>
  );

const PlaceDetails = (props: { readonly place: typeof Place.Type }) => {
  if (props.place.cuisine === null && props.place.priceLevel === null) {
    return null;
  }

  return (
    <p className="text-muted-foreground flex flex-wrap gap-x-2 text-sm">
      {props.place.cuisine === null ? null : <span>{props.place.cuisine}</span>}
      {props.place.cuisine === null ||
      props.place.priceLevel === null ? null : (
        <span aria-hidden="true">·</span>
      )}
      {props.place.priceLevel === null ? null : (
        <PriceMarks level={props.place.priceLevel} />
      )}
    </p>
  );
};

export const PlaceList = (props: {
  readonly places: readonly (typeof Place.Type)[];
}) => {
  const reduceMotion = useReducedMotion() === true;

  return (
    <ul className="divide-border flex flex-col divide-y">
      {props.places.map((place, index) => (
        <motion.li
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          className="flex min-w-0 flex-col gap-1 py-3"
          initial={{
            opacity: 0,
            transform: reduceMotion ? "none" : "translateY(8px)",
          }}
          key={place.placeId}
          transition={{
            delay: Math.min(index, STAGGERED_ITEMS) * STAGGER_SECONDS,
            duration: 0.2,
            ease: ENTER_EASE,
          }}
        >
          <p className="font-medium text-pretty">{place.name}</p>
          <p className="text-muted-foreground text-sm text-pretty">
            {place.address}
          </p>
          <PlaceDetails place={place} />
        </motion.li>
      ))}
    </ul>
  );
};
