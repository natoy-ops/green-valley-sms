"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, MapPin, Boxes, LayoutList, LayoutGrid } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Facility {
  id: string;
  name: string;
  type: string;
  location: string;
  imageUrl?: string | null;
  capacity?: number | null;
  status: "operational" | "maintenance" | "out_of_service" | "retired";
}

function shouldRedirectToLogin(response: Response): boolean {
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return true;
  }
  return false;
}

function FacilityImageBanner({ facility }: { facility: Facility }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative h-24 w-full overflow-hidden transition-all duration-300 group-hover:h-full">
      {facility.imageUrl && (
        <img
          src={facility.imageUrl}
          alt={facility.name}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          className={`h-full w-full object-cover transition-[filter,transform,opacity] duration-300 ${
            isLoaded ? "blur-0 scale-100 opacity-100" : "blur-sm scale-105 opacity-80"
          }`}
        />
      )}
      {!facility.imageUrl && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-500" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent pointer-events-none" />
      <div className="relative z-10 flex h-full w-full items-end justify-between px-4 pb-3 text-emerald-50">
        <div className="max-w-[70%]">
          <p className="text-sm font-semibold leading-snug line-clamp-1">{facility.name}</p>
          <p className="text-[11px] opacity-90 line-clamp-1">{facility.type}</p>
        </div>
        <span
          className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium
            ${
              facility.status === "operational"
                ? "bg-emerald-50/20 text-emerald-50 border border-emerald-100/60"
                : facility.status === "maintenance"
                ? "bg-amber-50/20 text-amber-50 border border-amber-100/60"
                : facility.status === "out_of_service"
                ? "bg-red-50/20 text-red-50 border border-red-100/60"
                : "bg-gray-50/20 text-gray-50 border border-border/50/60"
            }
          `}
        >
          {facility.status === "operational"
            ? "Operational"
            : facility.status === "maintenance"
            ? "Under Maintenance"
            : facility.status === "out_of_service"
            ? "Out of Service"
            : "Retired"}
        </span>
      </div>
    </div>
  );
}

export default function FacilitiesPage() {
  const router = useRouter();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "cards">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [editFormState, setEditFormState] = useState<{
    name: string;
    type: string;
    location: string;
    imageUrl: string;
    capacity: string;
    status: Facility["status"];
  } | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    type: "",
    location: "",
    imageUrl: "",
    capacity: "",
    status: "operational" as Facility["status"],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadFacilities() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/facilities", {
          method: "GET",
        });

        if (shouldRedirectToLogin(response)) {
          return;
        }

        const body = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: { facilities: Facility[] }; error?: { message?: string } }
          | null;

        if (!response.ok || !body) {
          const message = body?.error?.message ?? "Unable to load facilities.";
          throw new Error(message);
        }

        if (!body.success || !body.data) {
          throw new Error("Unexpected response when loading facilities.");
        }

        if (!isCancelled) {
          setFacilities(body.data.facilities);
        }
      } catch (error) {
        if (!isCancelled) {
          const message = error instanceof Error ? error.message : "Unable to load facilities.";
          setErrorMessage(message);
          toast.error("Failed to load facilities", {
            description: message,
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFacilities();

    return () => {
      isCancelled = true;
    };
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFormState((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = formState.name.trim();
    const trimmedType = formState.type.trim();
    const trimmedLocation = formState.location.trim();
    const trimmedImageUrl = formState.imageUrl ? formState.imageUrl.trim() : "";

    if (!trimmedName || !trimmedType || !trimmedLocation) {
      return;
    }

    const capacityNumber = formState.capacity ? Number(formState.capacity) : undefined;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/facilities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          type: trimmedType,
          location: trimmedLocation,
          imageUrl: trimmedImageUrl || undefined,
          capacity: Number.isNaN(capacityNumber) ? undefined : capacityNumber,
          status: formState.status,
        }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { facility: Facility };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? "Unable to save facility.";
        throw new Error(message);
      }

      setFacilities((previous) => [body.data!.facility, ...previous]);

      setFormState({
        name: "",
        type: "",
        location: "",
        imageUrl: "",
        capacity: "",
        status: "operational",
      });

      toast.success("Facility added", {
        description: `${trimmedName} has been created successfully.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save facility.";
      setErrorMessage(message);
      toast.error("Unable to save facility", {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function openFacilityDialog(facility: Facility) {
    setSelectedFacility(facility);
    setEditFormState({
      name: facility.name,
      type: facility.type,
      location: facility.location,
      imageUrl: facility.imageUrl ?? "",
      capacity:
        facility.capacity != null && !Number.isNaN(facility.capacity)
          ? String(facility.capacity)
          : "",
      status: facility.status,
    });
  }

  function closeFacilityDialog() {
    setSelectedFacility(null);
    setEditFormState(null);
  }

  function handleEditChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    if (!editFormState) return;
    const { name, value } = event.target;
    setEditFormState((previous) =>
      previous ? { ...previous, [name]: value } : previous
    );
  }

  async function handleEditSave() {
    if (!selectedFacility || !editFormState || isEditSubmitting) return;

    const trimmedName = editFormState.name.trim();
    const trimmedType = editFormState.type.trim();
    const trimmedLocation = editFormState.location.trim();
    const trimmedImageUrl = editFormState.imageUrl
      ? editFormState.imageUrl.trim()
      : "";

    if (!trimmedName || !trimmedType || !trimmedLocation) {
      return;
    }

    const capacityNumber = editFormState.capacity
      ? Number(editFormState.capacity)
      : undefined;

    setIsEditSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/facilities/${selectedFacility.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          type: trimmedType,
          location: trimmedLocation,
          imageUrl: trimmedImageUrl || undefined,
          capacity:
            capacityNumber != null && !Number.isNaN(capacityNumber)
              ? capacityNumber
              : null,
          status: editFormState.status,
        }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { facility: Facility };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? "Unable to update facility.";
        throw new Error(message);
      }

      const updatedFacility = body.data.facility;

      setFacilities((previous) =>
        previous.map((facility) =>
          facility.id === updatedFacility.id ? updatedFacility : facility
        )
      );

      setSelectedFacility(null);
      setEditFormState(null);

      toast.success("Changes saved", {
        description: `${trimmedName} has been updated successfully.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update facility.";
      setErrorMessage(message);
      toast.error("Unable to update facility", {
        description: message,
      });
    } finally {
      setIsEditSubmitting(false);
    }
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredFacilities = normalizedQuery
    ? facilities.filter((facility) => {
        const name = facility.name.toLowerCase();
        const type = facility.type.toLowerCase();
        const location = facility.location.toLowerCase();
        return (
          name.includes(normalizedQuery) ||
          type.includes(normalizedQuery) ||
          location.includes(normalizedQuery)
        );
      })
    : facilities;

  return (
    <div className="flex-1 flex flex-col space-y-6 min-h-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Facilities</h1>
            <p className="text-sm text-muted-foreground">
              Register and track key school facilities such as buildings, rooms, labs, and shared assets.
            </p>
            {errorMessage && (
              <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
            )}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="text-sm"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <Card className="lg:col-span-1 border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">Add Facility</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Capture basic details about a new school facility.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-muted-foreground" htmlFor="name">
                  Facility Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formState.name}
                  onChange={handleChange}
                  placeholder="e.g. Main Building, Computer Lab 1"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-muted-foreground" htmlFor="type">
                  Type
                </label>
                <input
                  id="type"
                  name="type"
                  type="text"
                  required
                  value={formState.type}
                  onChange={handleChange}
                  placeholder="e.g. Classroom, Laboratory, Office, Facility"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-muted-foreground" htmlFor="location">
                  Location / Identifier
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground/70">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    required
                    value={formState.location}
                    onChange={handleChange}
                    placeholder="e.g. Building A - Room 203"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-muted-foreground" htmlFor="imageUrl">
                  Image URL (optional)
                </label>
                <input
                  id="imageUrl"
                  name="imageUrl"
                  type="url"
                  value={formState.imageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/facility-photo.jpg"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground" htmlFor="capacity">
                    Capacity (optional)
                  </label>
                  <input
                    id="capacity"
                    name="capacity"
                    type="number"
                    min={0}
                    value={formState.capacity}
                    onChange={handleChange}
                    onWheel={(event) => event.currentTarget.blur()}
                    placeholder="e.g. 40"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground" htmlFor="status">
                    Status
                  </label>
                  <Select
                    value={formState.status}
                    onValueChange={(value: Facility["status"]) => {
                      setFormState((previous) => ({ ...previous, status: value }));
                    }}
                  >
                    <SelectTrigger className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operational">Operational</SelectItem>
                      <SelectItem value="maintenance">Under Maintenance</SelectItem>
                      <SelectItem value="out_of_service">Out of Service</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#1B4D3E] text-white hover:bg-[#163e32] text-sm px-4 py-2 rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                {isSubmitting ? "Saving..." : "Save Facility"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Registered Facilities</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Quick overview of facilities configured for this school.
              </CardDescription>
            </div>
            <div className="flex flex-1 items-center justify-end gap-3">
              <div className="hidden lg:flex flex-1 max-w-sm items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search facilities by name, type, or location..."
                  className="w-full px-3 py-2 text-xs border border-border rounded-full bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                />
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <Boxes className="h-4 w-4" />
                <span>
                  {isLoading
                    ? "Loading..."
                    : normalizedQuery
                    ? `${filteredFacilities.length} of ${facilities.length} matching`
                    : `${facilities.length} total`}
                </span>
              </div>
              <div className="inline-flex items-center rounded-full bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-muted-foreground"
                  }`}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`ml-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "cards"
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-muted-foreground"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto px-4 pb-4 pt-3 hide-scrollbar">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground space-y-2">
                  <Building2 className="h-8 w-8 text-gray-300" />
                  <p className="font-medium text-muted-foreground">Loading facilities...</p>
                </div>
              ) : facilities.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground space-y-2">
                  <Building2 className="h-8 w-8 text-gray-300" />
                  <p className="font-medium text-muted-foreground">No facilities added yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Use the form on the left to add your first facility. You can capture buildings, rooms, labs, and more.
                  </p>
                </div>
              ) : filteredFacilities.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground space-y-2">
                  <Building2 className="h-8 w-8 text-gray-300" />
                  <p className="font-medium text-muted-foreground">No facilities match your search</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Try adjusting your search terms or clearing the search to see all facilities.
                  </p>
                </div>
              ) : viewMode === "list" ? (
                <Table className="min-w-full table-filter-animate">
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="font-bold text-primary">Name</TableHead>
                      <TableHead className="font-bold text-primary">Type</TableHead>
                      <TableHead className="font-bold text-primary">Location</TableHead>
                      <TableHead className="font-bold text-primary">Capacity</TableHead>
                      <TableHead className="text-right font-bold text-primary">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="table-filter-animate">
                    {filteredFacilities.map((facility) => (
                      <TableRow
                        key={facility.id}
                        className="cursor-pointer hover:bg-card hover:shadow-sm hover:-translate-y-0.5 hover:border-border/50 transition-all duration-150"
                        onClick={() => openFacilityDialog(facility)}
                      >
                        <TableCell className="font-medium text-foreground">{facility.name}</TableCell>
                        <TableCell className="text-muted-foreground">{facility.type}</TableCell>
                        <TableCell className="text-muted-foreground">{facility.location}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {facility.capacity != null && !Number.isNaN(facility.capacity)
                            ? facility.capacity
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${
                                facility.status === "operational"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  : facility.status === "maintenance"
                                  ? "bg-amber-50 text-amber-700 border border-amber-100"
                                  : facility.status === "out_of_service"
                                  ? "bg-red-50 text-red-700 border border-red-100"
                                  : "bg-gray-50 text-muted-foreground border border-border/50"
                              }
                            `}
                          >
                            {facility.status === "operational"
                              ? "Operational"
                              : facility.status === "maintenance"
                              ? "Under Maintenance"
                              : facility.status === "out_of_service"
                              ? "Out of Service"
                              : "Retired"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="table-filter-animate grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredFacilities.map((facility) => (
                    <div
                      key={facility.id}
                      className={`group relative h-48 overflow-hidden rounded-xl border shadow-sm bg-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md
                        ${
                          facility.status === "operational"
                            ? "border-emerald-300/70"
                            : facility.status === "maintenance"
                            ? "border-amber-300/70"
                            : facility.status === "out_of_service"
                            ? "border-red-300/70"
                            : "border-border/60"
                        }
                      `}
                      onClick={() => openFacilityDialog(facility)}
                    >
                      <FacilityImageBanner facility={facility} />
                      <div className="space-y-1.5 p-3 text-xs text-card-foreground transition-opacity duration-300 group-hover:opacity-0 group-hover:translate-y-2">
                        <p className="text-sm font-semibold text-card-foreground line-clamp-1">
                          {facility.name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-card-foreground/70" />
                          <span className="line-clamp-1 text-card-foreground/90">{facility.location}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Boxes className="h-3.5 w-3.5 text-card-foreground/70" />
                            <span className="text-card-foreground/90">
                              Capacity:{" "}
                              {facility.capacity != null && !Number.isNaN(facility.capacity)
                                ? facility.capacity
                                : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedFacility && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 dialog-backdrop-animate"
          onClick={closeFacilityDialog}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card text-card-foreground shadow-lg border border-border p-5 space-y-5 dialog-panel-animate"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-[#1B4D3E]/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-tight">
                  Edit Facility
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Update the key details for this facility. Changes are applied to the
                  current view.
                </p>
              </div>
            </div>
            {editFormState && (
              <div className="space-y-3 text-sm text-foreground">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
                    Name
                  </p>
                  <input
                    name="name"
                    type="text"
                    value={editFormState.name}
                    onChange={handleEditChange}
                    className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E]"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
                    Type
                  </p>
                  <input
                    name="type"
                    type="text"
                    value={editFormState.type}
                    onChange={handleEditChange}
                    className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E]"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
                    Location
                  </p>
                  <input
                    name="location"
                    type="text"
                    value={editFormState.location}
                    onChange={handleEditChange}
                    className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E]"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
                    Image URL
                  </p>
                  <input
                    name="imageUrl"
                    type="url"
                    value={editFormState.imageUrl}
                    onChange={handleEditChange}
                    className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
                      Capacity
                    </p>
                    <input
                      name="capacity"
                      type="number"
                      min={0}
                      value={editFormState.capacity}
                      onChange={handleEditChange}
                      className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E]"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
                      Status
                    </p>
                    <Select
                      value={editFormState.status}
                      onValueChange={(value: Facility["status"]) => {
                        setEditFormState((previous) =>
                          previous ? { ...previous, status: value } : previous,
                        );
                      }}
                    >
                      <SelectTrigger className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="maintenance">Under Maintenance</SelectItem>
                        <SelectItem value="out_of_service">Out of Service</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-3 mt-1 border-t border-border/80">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeFacilityDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleEditSave}
                disabled={isEditSubmitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 min-w-[7.5rem]"
              >
                {isEditSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
