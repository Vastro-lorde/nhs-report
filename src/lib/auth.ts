/* ──────────────────────────────────────────
   NextAuth v5 configuration
   ────────────────────────────────────────── */
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { getActiveCohort } from "@/lib/cohort-scope";
import { resolveSessionIdentity, type SessionIdentity } from "@/services/cohort.service";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      rootAdmin?: boolean;
      state?: string;
      states?: string[];
      profileImage?: string;
      aiAccessEnabled?: boolean;
      fellowId?: string;
      mentorId?: string;
      /** The live cohort this session's role/assignments were resolved in. */
      cohortId?: string;
    };
  }

  interface User {
    role: UserRole;
    rootAdmin?: boolean;
    state?: string;
    states?: string[];
    profileImage?: string;
    aiAccessEnabled?: boolean;
    fellowId?: string;
    mentorId?: string;
    cohortId?: string;
  }
}

declare module "next-auth" {
  interface JWT {
    id: string;
    role: UserRole;
    rootAdmin?: boolean;
    state?: string;
    states?: string[];
    profileImage?: string;
    aiAccessEnabled?: boolean;
    fellowId?: string;
    mentorId?: string;
    cohortId?: string;
  }
}

/** Login refused: the account has no place in the live cohort. */
class NotInCohortError extends CredentialsSignin {
  code = "not_in_cohort";
}
/** Login refused: the account belongs to a cohort that hasn't gone live yet. */
class CohortNotStartedError extends CredentialsSignin {
  code = "cohort_not_started";
}

function applyIdentity(target: Record<string, unknown>, identity: SessionIdentity) {
  target.role = identity.role;
  target.state = identity.state;
  target.states = identity.states;
  target.mentorId = identity.mentorId;
  target.fellowId = identity.fellowId;
  target.cohortId = identity.cohortId;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();

        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase().trim(),
          active: true,
        }).select("+password");

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) return null;

        // Everyone below admin must belong to the live cohort; their role and
        // assignments come from their profile in it.
        const resolved = await resolveSessionIdentity(user);
        if ("failure" in resolved) {
          throw resolved.failure === "cohort_not_started" ? new CohortNotStartedError() : new NotInCohortError();
        }
        const identity = resolved.identity;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: identity.role as UserRole,
          rootAdmin: user.rootAdmin,
          state: identity.state,
          states: identity.states,
          profileImage: user.profileImage,
          aiAccessEnabled: user.aiAccessEnabled ?? false,
          fellowId: identity.fellowId,
          mentorId: identity.mentorId,
          cohortId: identity.cohortId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.rootAdmin = user.rootAdmin;
        token.state = user.state;
        token.states = user.states;
        token.profileImage = user.profileImage;
        token.aiAccessEnabled = user.aiAccessEnabled;
        token.fellowId = user.fellowId;
        token.mentorId = user.mentorId;
        token.cohortId = user.cohortId;
      }

      // When a new cohort goes live, re-derive the role and assignments of
      // everyone below admin from their profile in it — or end the session if
      // they are not part of it. (Sessions issued before cohorts existed have
      // no cohortId and are refreshed the same way.)
      if (token.id && token.role !== UserRole.ADMIN) {
        try {
          await connectDB();
          const active = await getActiveCohort();
          if (token.cohortId !== String(active._id)) {
            const fresh = await User.findById(token.id).select("role active").lean();
            if (!fresh?.active) return null;
            const resolved = await resolveSessionIdentity(fresh);
            if ("failure" in resolved) return null;
            applyIdentity(token as Record<string, unknown>, resolved.identity);
          }
        } catch (err) {
          // Never lock everyone out over a transient DB error; retry next request.
          console.error("[auth] cohort refresh failed:", err);
        }
      }

      // When session.update() is called, refresh mutable fields from DB
      if (trigger === "update" && token.id) {
        try {
          await connectDB();
          const freshUser = await User.findById(token.id).select("name profileImage").lean();
          if (freshUser) {
            token.name = freshUser.name;
            token.profileImage = freshUser.profileImage;
          }
        } catch {
          // Silently ignore — keep existing token data
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      session.user.rootAdmin = token.rootAdmin as boolean | undefined;
      session.user.state = token.state as string;
      session.user.states = token.states as string[] | undefined;
      session.user.profileImage = token.profileImage as string | undefined;
      session.user.aiAccessEnabled = token.aiAccessEnabled as boolean | undefined;
      session.user.fellowId = token.fellowId as string | undefined;
      session.user.mentorId = token.mentorId as string | undefined;
      session.user.cohortId = token.cohortId as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
