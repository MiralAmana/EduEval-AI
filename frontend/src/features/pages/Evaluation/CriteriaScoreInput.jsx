import { Input } from "@/components/ui/input";

/**
 * Saisie du barème détaillé d'une question (une note par critère,
 * plafonnée à son maximum) avec le total recalculé en direct.
 * `values` est un objet { [criterionId]: number|string }.
 */
export default function CriteriaScoreInput({ criteria, values, onChange }) {
  const total = criteria.reduce(
    (sum, criterion) => sum + (Number(values[criterion.id]) || 0),
    0
  );
  const maxTotal = criteria.reduce(
    (sum, criterion) => sum + criterion.points,
    0
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        Barème détaillé
      </label>

      <div className="space-y-1.5">
        {criteria.map((criterion) => (
          <div
            key={criterion.id}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <span className="text-sm">{criterion.label}</span>

            <div className="flex shrink-0 items-center gap-1.5">
              <Input
                type="number"
                min="0"
                max={criterion.points}
                className="w-20"
                value={values[criterion.id] ?? ""}
                onChange={(event) =>
                  onChange(criterion.id, event.target.value)
                }
              />
              <span className="text-xs text-muted-foreground">
                / {criterion.points}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-right text-sm font-semibold">
        Total : {total} / {maxTotal}
      </p>
    </div>
  );
}
