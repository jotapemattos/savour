import { cn } from "#/lib/utils";

const STAR_PATH =
  "M12 2.6l2.85 5.9 6.5.82-4.78 4.5 1.24 6.43L12 17.1l-5.81 3.15 1.24-6.43-4.78-4.5 6.5-.82z";

const STARS = [1, 2, 3, 4, 5] as const;

export const starsLabel = (rating: number) =>
  rating === 1 ? "1 star" : `${rating} stars`;

const fillOf = (rating: number, star: number) =>
  Math.min(Math.max(rating - (star - 1), 0), 1);

const StarGlyph = (props: {
  readonly className: string;
  readonly fill: number;
}) => (
  <svg
    className={cn("absolute inset-0 size-full", props.className)}
    style={{ clipPath: `inset(0 ${100 - props.fill * 100}% 0 0)` }}
    viewBox="0 0 24 24"
  >
    <path d={STAR_PATH} />
  </svg>
);

export const StarRow = (props: {
  readonly rating: number;
  readonly starClassName: string;
}) => (
  <span aria-hidden="true" className="flex">
    {STARS.map((star) => (
      <span className={cn("relative shrink-0", props.starClassName)} key={star}>
        <StarGlyph
          className="stroke-muted-foreground fill-none stroke-[1.5]"
          fill={1}
        />
        <StarGlyph
          className="fill-primary stroke-primary stroke-[1.5]"
          fill={fillOf(props.rating, star)}
        />
      </span>
    ))}
  </span>
);

export const RatingStars = (props: { readonly rating: number }) => (
  <span aria-label={starsLabel(props.rating)} className="w-fit" role="img">
    <StarRow rating={props.rating} starClassName="size-4" />
  </span>
);
