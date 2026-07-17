import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const statusOptions = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "ACTIVE", label: "Actives" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "DISABLED", label: "Désactivées" },
  { value: "FINISHED", label: "Terminées" },
];

const typeOptions = [
  { value: "ALL", label: "Tous les types" },
  { value: "CLASSIC", label: "Questions classiques" },
  { value: "WORD", label: "Microsoft Word" },
  { value: "EXCEL", label: "Microsoft Excel" },
  { value: "POWERPOINT", label: "Microsoft PowerPoint" },
  { value: "MIXED", label: "Mixte" },
];

export default function SearchToolbar({
  search,
  status,
  type,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onReset,
}) {
  const hasFilters =
    search.trim() !== "" ||
    status !== "ALL" ||
    type !== "ALL";

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Rechercher par titre, code ou description..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <select
              value={status}
              onChange={(event) =>
                onStatusChange(event.target.value)
              }
              className="h-9 min-w-48 rounded-md border bg-transparent pl-9 pr-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              {statusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <select
            value={type}
            onChange={(event) =>
              onTypeChange(event.target.value)
            }
            className="h-9 min-w-48 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {typeOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
            >
              <X className="size-4" />
              Réinitialiser
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}