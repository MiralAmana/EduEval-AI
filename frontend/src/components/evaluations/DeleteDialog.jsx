import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

export default function DeleteDialog({
  open,
  evaluation,
  loading,
  onOpenChange,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Supprimer cette évaluation ?
          </DialogTitle>

          <DialogDescription>
            Cette action supprimera définitivement l’évaluation
            <strong className="mx-1 text-foreground">
              {evaluation?.title || ""}
            </strong>
            ainsi que ses questions, publications, tentatives et
            réponses.
          </DialogDescription>
        </DialogHeader>

        {evaluation && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium">{evaluation.title}</p>

            <p className="mt-1 text-muted-foreground">
              Publications :{" "}
              <span className="font-semibold text-foreground">
                {evaluation._count?.publications ??
                  evaluation.publications?.length ??
                  0}
              </span>
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>

          <Button
            type="button"
            variant="destructive"
            disabled={loading || !evaluation}
            onClick={onConfirm}
          >
            {loading
              ? "Suppression..."
              : "Supprimer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}