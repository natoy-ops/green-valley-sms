import { NextResponse } from "next/server";

function formatSuccess<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

export async function POST() {
  const response = NextResponse.json(
    formatSuccess({ message: "Logout successful" })
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  response.cookies.set("auth-token", "", cookieOptions);
  response.cookies.set("user-id", "", cookieOptions);
  response.cookies.set("user-roles", "", cookieOptions);
  response.cookies.set("school-id", "", cookieOptions);

  return response;
}
