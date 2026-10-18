import { Option } from "effect";

export const SESSION_COOKIE = "savour_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 604_800,
  path: "/",
  sameSite: "lax",
  secure: true,
} as const;

const decodeCookieValue = Option.liftThrowable(decodeURIComponent);

export const sessionTokenOf = (cookieHeader: string | null | undefined) =>
  Option.fromNullishOr(cookieHeader).pipe(
    Option.flatMap((header) =>
      Option.fromNullishOr(
        header
          .split(";")
          .map((pair) => pair.trim())
          .find((pair) => pair.startsWith(`${SESSION_COOKIE}=`))
      )
    ),
    Option.flatMap((pair) =>
      decodeCookieValue(pair.slice(SESSION_COOKIE.length + 1))
    ),
    Option.filter((token) => token.length > 0)
  );

export const withSessionBearer = (
  request: Request,
  cookieHeader: string | null | undefined
) => {
  const headers = new Headers(request.headers);
  const token = sessionTokenOf(cookieHeader);
  headers.delete("cookie");

  if (Option.isSome(token)) {
    headers.set("authorization", `Bearer ${token.value}`);
  }

  return new Request(request, { headers });
};
