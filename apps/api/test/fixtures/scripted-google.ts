import type { GoogleProfile } from "better-auth/social-providers";
import { Redacted } from "effect";

import type { GoogleSignInOptions } from "../../src/better-auth-accounts.js";

const googleIdentity = (
  sub: string,
  email: string,
  emailVerified: boolean
): GoogleProfile => ({
  aud: "test-google-client",
  azp: "test-google-client",
  email,
  email_verified: emailVerified,
  exp: 4_102_444_800,
  family_name: "",
  given_name: sub,
  iat: 1_767_225_600,
  iss: "https://accounts.google.com",
  name: sub,
  picture: "",
  sub,
});

const signedByGoogle = new Map<string, GoogleProfile>([
  ["valid-ana", googleIdentity("g-ana", "ana@example.test", true)],
  ["valid-new", googleIdentity("g-new", "new@example.test", true)],
  ["unverified-ana", googleIdentity("g-mallory", "ana@example.test", false)],
]);

export const scriptedGoogle: GoogleSignInOptions = {
  clientId: Redacted.make("test-google-client"),
  // oxlint-disable-next-line typescript/promise-function-async -- Better Auth calls provider hooks as native Promises.
  getUserInfo: ({ idToken }) => {
    const profile = signedByGoogle.get(idToken ?? "");

    return Promise.resolve(
      profile === undefined
        ? null
        : {
            data: profile,
            user: {
              email: profile.email,
              emailVerified: profile.email_verified,
              name: profile.name,
            },
          }
    );
  },
  // oxlint-disable-next-line typescript/promise-function-async -- Better Auth calls provider hooks as native Promises.
  verifyIdToken: (token) => Promise.resolve(signedByGoogle.has(token)),
};
