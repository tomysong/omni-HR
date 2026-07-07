import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: ResendOTP,
      validatePasswordRequirements: (password: string) => {
        if (
          password.length < 8 ||
          !/[a-zA-Z]/.test(password) ||
          !/[0-9]/.test(password)
        ) {
          throw new Error(
            "비밀번호는 8자 이상이며 영문과 숫자를 모두 포함해야 합니다.",
          );
        }
      },
    }),
  ],
});
