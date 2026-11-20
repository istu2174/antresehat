import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requiredRole, ROLE_HOME, type Role } from "@/lib/auth";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Supaya `npm run dev` tetap jalan sebelum .env.local diisi.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Jangan taruh kode di antara createServerClient dan getUser — ini yang me-refresh token.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needed = requiredRole(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/daftar";
  if (!needed && !isAuthPage) return response;

  // Redirect harus membawa cookie session yang mungkin baru di-refresh.
  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user) return isAuthPage ? response : redirectTo("/login");

  const { data: profil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (profil?.role ?? "pasien") as Role;

  if (isAuthPage || (needed && needed !== role)) return redirectTo(ROLE_HOME[role]);
  return response;
}
