import type { ComponentProps } from "react";

import { cn } from "#/lib/utils";

const variants = {
  destructive:
    "bg-destructive text-background h-11 w-full px-4 font-medium active:opacity-90",
  primary:
    "bg-primary text-primary-foreground h-11 w-full px-4 font-medium active:opacity-90",
  quiet:
    "text-muted-foreground hover:text-foreground active:bg-muted -mx-2 h-10 px-2",
} as const;

export const Button = ({
  className,
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { readonly variant?: keyof typeof variants }) => (
  <button
    className={cn(
      "focus-visible:outline-primary inline-flex shrink-0 items-center justify-center rounded-lg text-base transition-[opacity,background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 aria-disabled:opacity-60",
      variants[variant],
      className
    )}
    {...props}
  />
);
