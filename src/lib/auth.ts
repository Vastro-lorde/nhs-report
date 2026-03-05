/* ──────────────────────────────────────────
   NextAuth v5 configuration
   ────────────────────────────────────────── */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, Coordinator, Mentor, DeskOfficer } from "@/models";
import { UserRole } from "@/lib/constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      rootAdmin?: boolean;
      state?: string;
      profileImage?: string;
    };
  }

  interface User {
    role: UserRole;
    rootAdmin?: boolean;
    state?: string;
    profileImage?: string;
  }
}

declare module "next-auth" {
  interface JWT {
    id: string;
    role: UserRole;
    rootAdmin?: boolean;
    state?: string;
    profileImage?: string;
  }
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

        let userState: string | undefined = undefined;
        if (user.role === UserRole.COORDINATOR) {
          const coord = await Coordinator.findOne({ authId: user._id }).lean();
          userState = coord?.states?.[0];
        } else if (user.role === UserRole.MENTOR) {
          const mentor = await Mentor.findOne({ authId: user._id }).lean();
          userState = mentor?.states?.[0];
        } else if (user.role === UserRole.ZONAL_DESK_OFFICER) {
          const deskOfficer = await DeskOfficer.findOne({ authId: user._id }).lean();
          userState = deskOfficer?.states?.[0];
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          rootAdmin: user.rootAdmin,
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
        token.rootAdmin = user.rootAdmin;
        token.state = user.state;
        token.profileImage = user.profileImage;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      session.user.rootAdmin = token.rootAdmin as boolean | undefined;
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
