import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeVerification } from "@/lib/email-verification";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

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

      // GATE në SERVER (jo vetëm te middleware): email i paverifikuar → mohohet sesioni.
      if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

      return { id: user.id, email: user.email, role: user.role };
    },
  }),

  // Provider i dedikuar për verifikimin e email-it: kyç përdoruesin PA password,
  // kundrejt një kredenciali verifikimi (token linku OSE email+kod). Konsumimi është
  // atomik dhe njëpërdorimësh (shih consumeVerification). Thirret vetëm nga POST-i i
  // verifikimit (faqja /verify-email), kurrë nga hapja GET e linkut.
  CredentialsProvider({
    id: "verify-login",
    name: "Email Verification",
    credentials: {
      token: { label: "Token", type: "text" },
      email: { label: "Email", type: "email" },
      code: { label: "Code", type: "text" },
    },
    async authorize(credentials, req) {
      // Rate limit i verifikimit — fail-CLOSED: kur kufiri s'mund të garantohet (DB e
      // rate-limit-it s'arrihet), REFUZOJMË pa e konsumuar kredencialin (throw para consume).
      const ip = clientIpFromHeaders(req?.headers);
      if (!(await rateLimit(`verify:ip:${ip}`, 10, 10 * 60 * 1000, { failOpen: false }))) {
        throw new Error("rate_limited");
      }

      const result = credentials?.token
        ? await consumeVerification({ token: credentials.token })
        : credentials?.email && credentials?.code
          ? await consumeVerification({ email: credentials.email, code: credentials.code })
          : null;

      if (!result) return null;
      if (result.status === "ok") {
        return { id: result.user.id, email: result.user.email, role: result.user.role };
      }
      // Arsyeja e dështimit shkon te klienti (lexohet nga signIn redirect:false).
      throw new Error(result.status); // "expired" | "wrong_code" | "locked" | "invalid"
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

        // Prano VETËM nëse Google e jep email_verified === true (vendim sigurie).
        // undefined/false → mohohet; s'i japim verifikim pa konfirmim të qartë.
        const emailVerified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
        if (emailVerified !== true) return false;

        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true, emailVerified: true },
        });
        if (!existing) {
          // Llogari e re me Google → verified; Restaurant-i krijohet te /onboarding.
          await prisma.user.create({
            data: { email, role: "RESTAURANT_OWNER", emailVerified: true },
          });
        } else if (!existing.emailVerified) {
          // Linking i SIGURT i një llogarie ekzistuese të PAVERIFIKUAR: një password i
          // vendosur PARA verifikimit mund të jetë nga një palë tjetër (dikush regjistroi
          // këtë email pa pasur kontroll mbi inbox-in). Google provon zotërimin e inbox-it,
          // ndaj e verifikojmë — por HEQIM password-in e pabesueshëm dhe kredencialet e
          // verifikimit në fluturim. Përdoruesi vendos password të ri me "Kam harruar…".
          await prisma.user.update({
            where: { id: existing.id },
            data: { emailVerified: true, passwordHash: null, pendingRestaurantName: null },
          });
          await prisma.emailVerification.deleteMany({ where: { userId: existing.id } });
        }
        return true;
      }
      return true; // Credentials / verify-login trajtohen te authorize
    },

    async jwt({ token, user }) {
      // Në sign-in: zgjidh User-in tonë të DB-së sipas email-it — funksionon për
      // të dyja providerat (Google jep id-në e vet, jo id-në tonë).
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { id: true, role: true, emailVerified: true },
        });
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.emailVerified = dbUser.emailVerified;
        }
      }

      // Per-request: restoranti i pronarit (reflekton onboarding/verifikim menjëherë).
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
        session.user.emailVerified = (token.emailVerified as boolean | undefined) ?? false;
        session.user.restaurantId = (token.restaurantId as string | null) ?? null;
        session.user.restaurantSlug = (token.restaurantSlug as string | null) ?? null;
      }
      return session;
    },
  },
};
