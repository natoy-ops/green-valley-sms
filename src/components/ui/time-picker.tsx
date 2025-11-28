"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Period = "AM" | "PM"

type TimePickerProps = {
  value?: string // expected format: "HH:mm"
  onChange?: (value: string) => void
  minuteStep?: number
  placeholder?: string
  className?: string
}

function parseTime(value?: string | null): { hour: string | null; minute: string | null } {
  if (!value) return { hour: null, minute: null }
  const [h, m] = value.split(":")
  if (!h || !m) return { hour: null, minute: null }
  return { hour: h.padStart(2, "0"), minute: m.padStart(2, "0") }
}

function to12Hour(hour24: string | null): { hour: string | null; period: Period } {
  if (hour24 === null) {
    return { hour: null, period: "AM" }
  }
  const numeric = Number.parseInt(hour24, 10)
  const period: Period = numeric >= 12 ? "PM" : "AM"
  const hour12 = numeric % 12 === 0 ? 12 : numeric % 12
  return { hour: hour12.toString().padStart(2, "0"), period }
}

function to24Hour(hour12: string, period: Period): string {
  let numeric = Number.parseInt(hour12, 10) % 12
  if (period === "PM") {
    numeric += 12
  }
  return numeric.toString().padStart(2, "0")
}

export function TimePicker({
  value,
  onChange,
  minuteStep = 5,
  placeholder = "Select time",
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const skipExternalSyncRef = React.useRef(false)

  const { hour: initialHour, minute: initialMinute } = React.useMemo(
    () => parseTime(value),
    [value],
  )

  const initialPeriod = React.useMemo(() => to12Hour(initialHour).period, [initialHour])

  const [selectedHour, setSelectedHour] = React.useState<string | null>(initialHour)
  const [selectedMinute, setSelectedMinute] = React.useState<string | null>(initialMinute)
  const [selectedPeriod, setSelectedPeriod] = React.useState<Period>(initialPeriod)

  React.useEffect(() => {
    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false
      return
    }
    const { hour, minute } = parseTime(value)
    setSelectedHour(hour)
    setSelectedMinute(minute)
    setSelectedPeriod(to12Hour(hour).period)
  }, [value])

  const hourOptions = React.useMemo(
    () => ["12", ...Array.from({ length: 11 }, (_, i) => (i + 1).toString().padStart(2, "0"))],
    [],
  )

  const minutes = React.useMemo(
    () =>
      Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) =>
        (i * minuteStep).toString().padStart(2, "0"),
      ),
    [minuteStep],
  )

  const displayTime = React.useMemo(() => {
    if (!selectedHour || !selectedMinute) return ""
    const { hour } = to12Hour(selectedHour)
    return `${hour ?? "12"}:${selectedMinute} ${selectedPeriod}`
  }, [selectedHour, selectedMinute, selectedPeriod])

  const currentDisplayHour = React.useMemo(() => to12Hour(selectedHour).hour, [selectedHour])

  function commitTime(nextHour: string | null, nextMinute: string | null, shouldClose = false) {
    if (!nextHour || !nextMinute) return
    const next = `${nextHour}:${nextMinute}`
    skipExternalSyncRef.current = true
    onChange?.(next)
    if (shouldClose) {
      setOpen(false)
    }
  }

  function handleHourSelect(hour12: string) {
    const nextHour24 = to24Hour(hour12, selectedPeriod)
    setSelectedHour(nextHour24)
    if (selectedMinute) {
      commitTime(nextHour24, selectedMinute)
    }
  }

  function handlePeriodSelect(period: Period) {
    if (period === selectedPeriod) return
    setSelectedPeriod(period)
    if (currentDisplayHour) {
      const nextHour24 = to24Hour(currentDisplayHour, period)
      setSelectedHour(nextHour24)
      if (selectedMinute) {
        commitTime(nextHour24, selectedMinute, true)
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between text-left font-normal px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm",
            !displayTime && "text-muted-foreground",
            className,
          )}
        >
          <span>
            {displayTime || placeholder}
          </span>
          <Clock className="ml-2 h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 border border-border/60 bg-popover text-popover-foreground shadow-lg" align="start">
        <div className="flex flex-col gap-3">
          <div className="text-xs font-medium text-muted-foreground">Select time</div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-sm">
            <div>
              <div className="mb-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">Hour</div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border/40 bg-muted [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {hourOptions.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={cn(
                      "flex w-full items-center px-2.5 py-1.5 text-left text-muted-foreground hover:bg-card hover:text-foreground text-xs transition-colors",
                      currentDisplayHour === h &&
                        "bg-primary/10 text-primary font-semibold border-l-2 border-primary",
                    )}
                    onClick={() => handleHourSelect(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">Minute</div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border/40 bg-muted [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={cn(
                      "flex w-full items-center px-2.5 py-1.5 text-left text-muted-foreground hover:bg-card hover:text-foreground text-xs transition-colors",
                      selectedMinute === m &&
                        "bg-primary/10 text-primary font-semibold border-l-2 border-primary",
                    )}
                    onClick={() => {
                      const nextMinute = m
                      const fallbackHour12 = currentDisplayHour ?? "12"
                      const nextHour = selectedHour ?? to24Hour(fallbackHour12, selectedPeriod)
                      setSelectedMinute(nextMinute)
                      commitTime(nextHour, nextMinute)
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">Period</div>
              <div className="grid grid-rows-2 gap-2">
                {["AM", "PM"].map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={cn(
                      "flex items-center justify-center rounded-md border px-2 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                      selectedPeriod === period
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-primary",
                    )}
                    onClick={() => handlePeriodSelect(period as Period)}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
