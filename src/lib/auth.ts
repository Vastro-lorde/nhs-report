/* ──────────────────────────────────────────
   NextAuth v5 configuration
   ────────────────────────────────────────── */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, Coordinator, Mentor } from "@/models";
import { UserRole } from "@/lib/constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      state?: string;
      profileImage?: string;
    };
  }

  interface User {
    role: UserRole;
    state?: string;
    profileImage?: string;
  }
}

declare module "next-auth" {
  interface JWT {
    id: string;
    role: UserRole;
    state?: string;
    profileImage?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
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

        let userState: string | undefined = undefined;
        if (user.role === UserRole.COORDINATOR) {
          const coord = await Coordinator.findOne({ authId: user._id }).lean();
          userState = coord?.states?.[0];
        } else if (user.role === UserRole.MENTOR) {
          const mentor = await Mentor.findOne({ authId: user._id }).lean();
          userState = mentor?.state;
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          state: userState,
          profileImage: user.profileImage,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.state = user.state;
        token.profileImage = user.profileImage;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      session.user.state = token.state as string;
      session.user.profileImage = token.profileImage as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
