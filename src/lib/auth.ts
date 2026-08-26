import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase().trim() },
      });
      if (!user) return null;
      // Përdoruesit Google-only s'kanë password → s'lejohen të kyçen me password.
      if (!user.passwordHash) return null;

      const valid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, email: user.email, role: user.role };
    },
  }),
];

// Shto Google vetëm nëse është konfiguruar (app-i punon me Credentials edhe pa të).
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    // Linking manual sipas email-it (JWT strategy, pa adapter).
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase();
        if (!email) return false;

        // Prano vetëm email të verifikuar nga Google (vendim sigurie).
        const emailVerified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
        if (emailVerified === false) return false;

        // Nëse s'ekziston → krijo User (RESTAURANT_OWNER, pa password).
        // Restaurant NUK krijohet ende — bëhet te /onboarding.
        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (!existing) {
          await prisma.user.create({ data: { email, role: "RESTAURANT_OWNER" } });
        }
        return true;
      }
      return true; // Credentials trajtohet te authorize
    },

    async jwt({ token, user }) {
      // Në sign-in: zgjidh User-in tonë të DB-së sipas email-it — funksionon për
      // të dyja providerat (Google jep id-në e vet, jo id-në tonë).
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
        }
      }

      // Per-request: restoranti i pronarit (reflekton /onboarding menjëherë).
      if (token.role === "RESTAURANT_OWNER" && token.sub) {
        const restaurant = await prisma.restaurant.findFirst({
          where: { ownerId: token.sub },
          select: { id: true, slug: true },
        });
        token.restaurantId = restaurant?.id ?? null;
        token.restaurantSlug = restaurant?.slug ?? null;
      } else {
        token.restaurantId = null;
        token.restaurantSlug = null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as string) ?? "RESTAURANT_OWNER";
        session.user.restaurantId = (token.restaurantId as string | null) ?? null;
        session.user.restaurantSlug = (token.restaurantSlug as string | null) ?? null;
      }
      return session;
    },
  },
};
