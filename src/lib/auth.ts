import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { cookies } from "next/headers";
import { resolveOAuthSignIn, OAUTH_PROVIDERS, type OAuthProvider } from "@/modules/accounts/oauth";
import { LINK_INTENT_COOKIE, readLinkIntent } from "@/modules/accounts/link-intent";
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

// Ofruesit OAuth shtohen vetëm kur janë konfiguruar (app-i punon me email edhe pa ta).
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}
// Sign in with Apple: kërkon Services ID (APPLE_CLIENT_ID) dhe client secret JWT (APPLE_CLIENT_SECRET,
// i nënshkruar me çelësin .p8; skadon ≤ 6 muaj). Pa to, ofruesi s'shtohet dhe butoni s'shfaqet.
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    })
  );
}

function isOAuth(p: string | undefined): p is OAuthProvider {
  return !!p && (OAUTH_PROVIDERS as readonly string[]).includes(p);
}

/** email_verified i ofruesit: Google jep boolean; Apple mund ta japë si "true" (string). */
function providerEmailVerified(profile: unknown): boolean {
  const v = (profile as { email_verified?: unknown } | undefined)?.email_verified;
  return v === true || v === "true";
}

/** Link intent i vlefshëm për këtë ofrues (cookie HttpOnly), i konsumuar pas leximit. */
function takeLinkIntent(provider: string): string | null {
  try {
    const jar = cookies();
    const uid = readLinkIntent(jar.get(LINK_INTENT_COOKIE)?.value, provider);
    if (jar.get(LINK_INTENT_COOKIE)) jar.delete(LINK_INTENT_COOKIE);
    return uid;
  } catch {
    return null; // jashtë kontekstit të kërkesës
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    // OAuth: vendimi bëhet te resolveOAuthSignIn (identitet = provider + providerAccountId).
    async signIn({ account, profile, user }) {
      if (!isOAuth(account?.provider)) return true; // Credentials / verify-login → authorize
      const linkIntentUserId = takeLinkIntent(account!.provider);
      const decision = await resolveOAuthSignIn(
        {
          provider: account!.provider,
          providerAccountId: String(account!.providerAccountId),
          email: user?.email ?? (profile as { email?: string } | undefined)?.email ?? null,
          emailVerified: providerEmailVerified(profile),
        },
        linkIntentUserId
      );
      if (decision.ok) return true;
      if (linkIntentUserId) return `/account?link=${decision.reason}`;
      return `/login?error=${decision.reason}&provider=${account!.provider}`;
    },

    async jwt({ token, user, account }) {
      // Në hyrje: përdoruesi ynë zgjidhet nga identiteti (OAuth) ose nga id-ja (Credentials) — jo nga email-i.
      if (user && account) {
        if (isOAuth(account.provider)) {
          const link = await prisma.oAuthAccount.findUnique({
            where: { provider_providerAccountId: { provider: account.provider, providerAccountId: String(account.providerAccountId) } },
            select: { userId: true },
          });
          if (link) token.sub = link.userId;
        } else if (user.id) {
          token.sub = user.id;
        }
        token.authTime = Date.now(); // për rikonfirmimin para lidhjes së një metode të re
      }

      if (token.sub) {
        // Rifreskim për çdo kërkesë: roli + verifikimi + restoranti aktiv (hint; autoriteti është në server).
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            role: true,
            emailVerified: true,
            activeRestaurantId: true,
            memberships: {
              where: { status: "active" },
              orderBy: { createdAt: "asc" },
              select: { restaurantId: true, role: true, restaurant: { select: { slug: true } } },
            },
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.emailVerified = dbUser.emailVerified;
          const memberships = dbUser.role === "SUPER_ADMIN" ? [] : dbUser.memberships;
          const active = memberships.find((m) => m.restaurantId === dbUser.activeRestaurantId) ?? memberships[0] ?? null;
          token.activeRestaurantId = active?.restaurantId ?? null;
          token.activeRole = active?.role ?? null;
          token.restaurantId = active?.restaurantId ?? null;
          token.restaurantSlug = active?.restaurant.slug ?? null;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as string) ?? "USER";
        session.user.emailVerified = (token.emailVerified as boolean | undefined) ?? false;
        session.user.restaurantId = (token.restaurantId as string | null) ?? null;
        session.user.restaurantSlug = (token.restaurantSlug as string | null) ?? null;
        session.user.activeRole = (token.activeRole as string | null) ?? null;
      }
      return session;
    },
  },
};
