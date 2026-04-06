import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Users stored as JSON in env var
// Format: [{"name":"Ahmed","pin":"1234"},{"name":"Lama","pin":"5678"},...]
function getUsers(): Array<{ name: string; pin: string }> {
  try {
    return JSON.parse(process.env.AUTHORIZED_USERS || "[]");
  } catch {
    return [];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "PIN Login",
      credentials: {
        name: { label: "Name", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.name || !credentials?.pin) return null;

        const users = getUsers();
        const user = users.find(
          (u) => u.name === credentials.name && u.pin === credentials.pin
        );

        if (!user) return null;

        return {
          id: user.name,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — reps stay logged in
  },
  pages: {
    signIn: "/login",
  },
};
