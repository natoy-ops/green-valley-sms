import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { EventRepository } from "@/modules/sems";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface EventPublicPageProps {
  params: { eventId: string };
}

async function getPublicEvent(eventId: string) {
  const supabase = getAdminSupabaseClient();
  const eventRepository = new EventRepository(supabase);
  const event = await eventRepository.findByIdWithFacility(eventId);

  if (!event) {
    return null;
  }

  if (event.visibility !== "public" || event.lifecycleStatus !== "published") {
    return null;
  }

  return event;
}

export async function generateMetadata({
  params,
}: EventPublicPageProps): Promise<Metadata> {
  const event = await getPublicEvent(params.eventId);

  if (!event) {
    return {
      title: "Event not found | School Events",
    };
  }

  return {
    title: `${event.title} | School Events`,
    description: event.description ?? undefined,
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
      images: event.posterImageUrl
        ? [{ url: event.posterImageUrl }]
        : [],
      type: "website",
    },
  };
}

export default async function EventPublicPage({ params }: EventPublicPageProps) {
  const event = await getPublicEvent(params.eventId);

  if (!event) {
    notFound();
  }

  const dateRange = `${event.startDate} – ${event.endDate}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="space-y-2 text-center">
          <p className="text-xs font-medium tracking-wide text-emerald-700">
            Green Valley Foundation College Inc.
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {event.title}
          </h1>
        </header>
        <Card className="overflow-hidden border-emerald-100 bg-white/90 shadow-sm">
          <CardHeader className="gap-4 pb-4">
            {event.posterImageUrl && (
              <div className="overflow-hidden rounded-xl border border-emerald-100 bg-muted/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.posterImageUrl}
                  alt={event.title}
                  className="h-56 w-full object-cover"
                />
              </div>
            )}
            <div className="space-y-2">
              <CardTitle className="text-lg font-semibold leading-snug">
                {event.title}
              </CardTitle>
              <CardDescription className="space-y-1 text-xs">
                <div className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>{dateRange}</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{event.sessionConfig ? "See schedule on campus" : ""}</span>
                </div>
                {event.facility && (
                  <div className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{event.facility.name}</span>
                  </div>
                )}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pb-6 text-sm text-slate-700">
            {event.description && <p className="whitespace-pre-line">{event.description}</p>}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>Public school event</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
