import Resend from "@auth/core/providers/resend";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ verify: ResendOTP }), Resend],
});
