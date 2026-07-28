export const PASSWORD_STRENGTH_LEVELS = [
  { label: "Trop court", className: "bg-destructive" },
  { label: "Faible", className: "bg-destructive" },
  { label: "Moyen", className: "bg-amber-500" },
  { label: "Bon", className: "bg-amber-500" },
  { label: "Fort", className: "bg-emerald-500" },
];

export function getPasswordStrength(password) {
  if (!password) {
    return null;
  }

  if (password.length < 8) {
    return PASSWORD_STRENGTH_LEVELS[0];
  }

  let score = 1;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  }

  return PASSWORD_STRENGTH_LEVELS[score];
}
