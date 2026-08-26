import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
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

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // Fut rolin (dhe restorantin kryesor) në token.
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "RESTAURANT_OWNER";
      }
      // Për RESTAURANT_OWNER, gjej restorantin e parë (mbështet zinxhirë më vonë).
      if (token.role === "RESTAURANT_OWNER" && token.sub) {
        const restaurant = await prisma.restaurant.findFirst({
          where: { ownerId: token.sub },
          select: { id: true, slug: true },
        });
        token.restaurantId = restaurant?.id ?? null;
        token.restaurantSlug = restaurant?.slug ?? null;
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
