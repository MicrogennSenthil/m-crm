import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date | string | null
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  "data-testid"?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  "data-testid": testId,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Convert string value to Date if needed - handle timezone properly
  const dateValue = React.useMemo(() => {
    if (!value) return undefined
    if (value instanceof Date) return value
    if (typeof value === "string") {
      // Parse date string without timezone conversion
      // For "YYYY-MM-DD" format, parse as local date
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number)
        return new Date(year, month - 1, day)
      }
      // For ISO strings with time, extract just the date part
      if (value.includes('T')) {
        const datePart = value.split('T')[0]
        const [year, month, day] = datePart.split('-').map(Number)
        return new Date(year, month - 1, day)
      }
      const parsed = new Date(value)
      return isNaN(parsed.getTime()) ? undefined : parsed
    }
    return undefined
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateValue && "text-muted-foreground",
            className
          )}
          data-testid={testId}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? format(dateValue, "dd/MM/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

// Compact version for use in smaller spaces like table cells or cards
interface DatePickerCompactProps extends DatePickerProps {
  size?: "sm" | "default"
}

export function DatePickerCompact({
  value,
  onChange,
  placeholder = "Select date",
  className,
  disabled,
  size = "sm",
  "data-testid": testId,
}: DatePickerCompactProps) {
  const [open, setOpen] = React.useState(false)

  // Convert string value to Date if needed - handle timezone properly
  const dateValue = React.useMemo(() => {
    if (!value) return undefined
    if (value instanceof Date) return value
    if (typeof value === "string") {
      // Parse date string without timezone conversion
      // For "YYYY-MM-DD" format, parse as local date
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number)
        return new Date(year, month - 1, day)
      }
      // For ISO strings with time, extract just the date part
      if (value.includes('T')) {
        const datePart = value.split('T')[0]
        const [year, month, day] = datePart.split('-').map(Number)
        return new Date(year, month - 1, day)
      }
      const parsed = new Date(value)
      return isNaN(parsed.getTime()) ? undefined : parsed
    }
    return undefined
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            size === "sm" && "h-9 text-xs",
            !dateValue && "text-muted-foreground",
            className
          )}
          data-testid={testId}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          {dateValue ? format(dateValue, "dd/MM/yyyy") : <span className="truncate">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
