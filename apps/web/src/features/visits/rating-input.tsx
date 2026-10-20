import { useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import { Button } from "#/components/ui/button";

import { StarRow, starsLabel } from "./stars";

const STEP = 0.5;

const LOWEST = 0.5;

const HIGHEST = 5;

const HALVES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

const stepUp = (rating: number | null) =>
  Math.min((rating ?? 0) + STEP, HIGHEST);

const stepDown = (rating: number | null) =>
  Math.max((rating ?? LOWEST) - STEP, LOWEST);

const keySteps = new Map([
  ["ArrowDown", stepDown],
  ["ArrowLeft", stepDown],
  ["ArrowRight", stepUp],
  ["ArrowUp", stepUp],
  ["End", () => HIGHEST],
  ["Home", () => LOWEST],
]);

export const RatingInput = (props: {
  readonly defaultValue?: number | null;
  readonly error?: string | undefined;
  readonly name: string;
}) => {
  const [rating, setRating] = useState<number | null>(
    props.defaultValue ?? null
  );

  const slider = useRef<HTMLDivElement>(null);

  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = keySteps.get(event.key);

    if (move !== undefined) {
      event.preventDefault();
      setRating(move(rating));
    }
  };

  const tap = (event: MouseEvent<HTMLDivElement>) => {
    const { target } = event;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const half = HALVES.find((value) => String(value) === target.dataset.value);

    if (half !== undefined) {
      setRating((current) => (current === half ? null : half));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <span className="text-sm leading-none font-medium" id="rating-label">
          Rating
        </span>
        {rating === null ? null : (
          <Button
            onClick={() => {
              setRating(null);
              slider.current?.focus();
            }}
            type="button"
            variant="quiet"
          >
            Clear rating
          </Button>
        )}
      </div>
      <div
        aria-describedby={
          props.error === undefined ? undefined : "rating-error"
        }
        aria-invalid={props.error !== undefined}
        aria-labelledby="rating-label"
        aria-valuemax={HIGHEST}
        aria-valuemin={LOWEST}
        aria-valuenow={rating ?? undefined}
        aria-valuetext={rating === null ? "No rating" : starsLabel(rating)}
        className="focus-visible:outline-primary relative w-fit touch-manipulation rounded-lg select-none focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={tap}
        onKeyDown={step}
        ref={slider}
        role="slider"
        tabIndex={0}
      >
        <StarRow rating={rating ?? 0} starClassName="size-12" />
        <span aria-hidden="true" className="absolute inset-0 flex">
          {HALVES.map((value) => (
            <span className="h-full w-6" data-value={value} key={value} />
          ))}
        </span>
      </div>
      {props.error === undefined ? null : (
        <p className="text-destructive text-sm text-pretty" id="rating-error">
          {props.error}
        </p>
      )}
      {rating === null ? null : (
        <input name={props.name} type="hidden" value={rating} />
      )}
    </div>
  );
};
