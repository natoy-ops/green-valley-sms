# SEMS Event Social Media Sharing & Poster Upload Summary

## Main Point

Extend the SEMS event workflow so **event organizers** can author social-media-ready descriptions and upload poster images, and so **students/parents** see social-friendly event cards with a Facebook share flow that respects Facebook's current limitations.

## Key Changes

- **Database & Domain Model**
  - Added `poster_image_url` column to `public.events` (Phase_1.9 migration).
  - Updated SEMS domain types (`EventRow`, `CreateEventDto`, `UpdateEventDto`, `EventDto`) to include `posterImageUrl`.
  - Extended list DTOs (`EventListItemDto`, `EventListResponseDto`) so student/parent event lists can access `description` and `posterImageUrl` for social previews.

- **Repository & API**
  - Extended `EventRepository` create/update/select methods to read/write `poster_image_url`.
  - Updated `/api/sems/events` POST/PUT handlers to accept `posterImageUrl` and pass it through the service layer.
  - Enriched student/parent event list APIs so each list item includes:
    - Core data: `title`, `timeRange`, `venue`, `audienceSummary`, `status`, `startDate`, `endDate`, `visibility`.
    - Social data: `description`, `posterImageUrl`.
    - Student-specific extras: `mySessions` and facility thumbnail where available.

- **Poster Upload Endpoint**
  - `POST /api/sems/events/poster-upload`:
    - Authenticated via existing role guard.
    - Accepts `multipart/form-data` with `file` (image up to 5 MB).
    - Uploads to Supabase Storage bucket `event-posters` under `posters/{timestamp}-{random}.{ext}`.
    - Returns a public URL used as `posterImageUrl`.

- **Create/Edit Event UI (Dashboard)**
  - Reuses **Event Description** as the primary social media caption, with explicit hint text in the UI.
  - Adds **Event Poster Image** section:
    - Drag-and-drop or click-to-select local image files.
    - Shows upload progress state and validation (type/size) with shadcn/sonner toasts.
    - On success, renders a live image preview and stores the returned URL in state.
    - Submits `posterImageUrl` as a hidden field so existing event create/update logic remains unchanged.

- **Student / Parent Event Views & Facebook Sharing**
  - **Student Events page (`/sems/student-events`)**
    - Modern, student-focused card layout that:
      - Uses the **poster image** as the primary thumbnail (falls back to venue image).
      - Shows status badge, date, time, venue, audience summary, and attendance bar.
    - Each card includes a **Facebook share icon** that opens a rich preview dialog:
      - Left side: poster, visibility label, title, description, date, time, venue.
      - Right side: "Add a personal message" textarea.
      - Footer actions:
        - **Copy caption**: composes a caption from the personal message + event details and copies it to the clipboard (with graceful fallback and toasts).
        - **Continue to Facebook**: opens Facebook's share dialog for the per-event public URL.
  - The dialog copy explicitly tells users they must **paste the caption** into Facebook themselves, matching Facebook's current policy (no prefilled text).

- **Public Event Page & Open Graph Metadata**
  - New public route: `/events/[eventId]`.
    - Loads the event via `EventRepository.findByIdWithFacility`.
    - Only returns events that are **public** and **published**; others return 404.
  - `generateMetadata` on this page sets:
    - Page `title` and `description` from the event.
    - `openGraph` metadata:
      - `title`: event title.
      - `description`: event description.
      - `images`: uses `posterImageUrl` when available.
      - `type`: `website`.
  - Facebook is directed to this URL when sharing, so the link preview uses the event's OG tags (poster + title + description).

- **Error Handling & UX**
  - Poster upload, event load, and create/update failures surface via shadcn/sonner toasts and inline messaging.
  - Copy-caption flow uses toasts to report success or failure and falls back to manual-select-and-copy if the Clipboard API is unavailable.
  - Existing event lifecycle, audience configuration, and session configuration behavior remain unchanged.

## Limitations & Notes

- **Facebook text prefill**
  - Facebook no longer allows third-party sites to prefill the "What's on your mind?" text box.
  - The system **cannot** force a caption into the post editor; users must paste the copied caption themselves.

- **URL accessibility**
  - Facebook must be able to reach the shared URL to render a preview.
  - Local development URLs (e.g., `http://localhost:3000`) will not produce a card on Facebook; a publicly accessible domain or tunnel is required.

## Outcome

Event organizers can now:
- Write descriptions that double as social media captions.
- Upload poster images directly from their devices (instead of manually pasting URLs).
- Rely on the system to store poster URLs in Supabase and expose them via the SEMS domain and APIs.

Students and parents can now:
- See visually rich event cards that highlight the poster image and key details.
- Open a Facebook share preview dialog for each event.
- Copy a ready-made caption (personal message + event info) and paste it into Facebook while sharing a link to the public event page with correct OG metadata.
