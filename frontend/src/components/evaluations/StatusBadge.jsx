const styles = {
  ACTIVE:
    "bg-green-100 text-green-700 border-green-300",

  DRAFT:
    "bg-yellow-100 text-yellow-700 border-yellow-300",

  DISABLED:
    "bg-red-100 text-red-700 border-red-300",

  FINISHED:
    "bg-blue-100 text-blue-700 border-blue-300",
};

const labels = {
  ACTIVE: "Active",
  DRAFT: "Brouillon",
  DISABLED: "Désactivée",
  FINISHED: "Terminée",
};

export default function StatusBadge({
  status,
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[status] ??
        "bg-gray-100 text-gray-700 border-gray-300"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}