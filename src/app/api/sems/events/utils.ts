import { NextResponse } from "next/server";
import type { WorkflowActorContext, ListEventsOptions } from "@/modules/sems";
import type { RoleGuardUser } from "@/core/auth/server-role-guard";

export function formatSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

export function formatError(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

export function buildActorContext(appUser: RoleGuardUser): WorkflowActorContext {
  return {
    userId: appUser.id,
    roles: appUser.roles,
  };
}

export function parseListEventsOptions(searchParams: URLSearchParams): ListEventsOptions {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const facilityId = searchParams.get("facilityId") ?? undefined;
  const searchTerm = searchParams.get("search") ?? undefined;

  return {
    page,
    pageSize,
    facilityId,
    searchTerm,
  };
}
