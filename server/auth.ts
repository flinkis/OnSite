import type { AuthConfig } from '@auth/core';
import Credentials from '@auth/core/providers/credentials';
import Google from '@auth/core/providers/google';
import bcrypt from 'bcryptjs';
import { checkRateLimit, resetRateLimit } from './lib/rate-limit.js';

export type AppRole = 'admin' | 'user';

declare module '@auth/core/types' {
  interface Session {
    role?: AppRole;
  }
  interface User {
    role?: AppRole;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role?: AppRole;
  }
}

export function createAuthConfig(env: {
  authSecret: string;
  authUrl: string;
  googleId?: string;
  googleSecret?: string;
  adminPasswordHash?: string;
}): AuthConfig {
  const providers = [];

  if (env.googleId && env.googleSecret) {
    providers.push(
      Google({
        clientId: env.googleId,
        clientSecret: env.googleSecret,
      }),
    );
  }

  if (env.adminPasswordHash) {
    providers.push(
      Credentials({
        id: 'credentials',
        name: 'Admin',
        credentials: {
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials, request) {
          const ip =
            request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            'unknown';
          const limit = checkRateLimit(`admin-login:${ip}`);
          if (!limit.allowed) {
            return null;
          }

          const password = credentials?.password as string | undefined;
          if (!password) {
            return null;
          }

          const valid = await bcrypt.compare(password, env.adminPasswordHash!);
          if (!valid) {
            return null;
          }

          resetRateLimit(`admin-login:${ip}`);
          return {
            id: 'admin',
            name: 'Admin',
            email: 'admin@local',
            role: 'admin' as AppRole,
          };
        },
      }),
    );
  }

  return {
    secret: env.authSecret,
    trustHost: true,
    basePath: '/api/auth',
    providers,
    session: { strategy: 'jwt' },
    pages: {
      signIn: '/login',
    },
    callbacks: {
      async jwt({ token, user, account }) {
        if (user) {
          token.role = (user as { role?: AppRole }).role ?? 'user';
          token.sub = user.id;
          token.name = user.name;
          token.email = user.email;
        } else if (account?.provider === 'google') {
          token.role = 'user';
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.name = (token.name as string | undefined) ?? session.user.name;
          session.user.email = (token.email as string | undefined) ?? session.user.email;
          (session.user as { id?: string }).id = token.sub;
        }
        session.role = token.role as AppRole | undefined;
        return session;
      },
      async redirect({ url, baseUrl }) {
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        if (new URL(url).origin === baseUrl) return url;
        return baseUrl;
      },
    },
  };
}
