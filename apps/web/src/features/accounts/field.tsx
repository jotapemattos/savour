import { useEffect, useRef } from "react";
import type { ComponentProps } from "react";

import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

export const Field = ({
  error,
  hint,
  label,
  ...input
}: ComponentProps<"input"> & {
  readonly error?: string | undefined;
  readonly hint?: string;
  readonly id: string;
  readonly label: string;
}) => {
  const control = useRef<HTMLInputElement>(null);

  const hintId = `${input.id}-hint`;
  const errorId = `${input.id}-error`;

  const describedBy = [
    hint === undefined ? "" : hintId,
    error === undefined ? "" : errorId,
  ]
    .join(" ")
    .trim();

  useEffect(() => {
    if (error !== undefined) {
      control.current?.focus();
    }
  }, [error]);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={input.id}>{label}</Label>
      <Input
        aria-describedby={describedBy === "" ? undefined : describedBy}
        aria-invalid={error !== undefined}
        ref={control}
        {...input}
      />
      {hint === undefined ? null : (
        <p className="text-muted-foreground text-sm text-pretty" id={hintId}>
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p className="text-destructive text-sm text-pretty" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
};
