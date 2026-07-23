const { Resend } = require("resend");

function getClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "La variable RESEND_API_KEY est absente du fichier backend/.env."
    );
  }

  return new Resend(process.env.RESEND_API_KEY);
}

async function sendResultsPublishedEmail({
  to,
  firstName,
  evaluationTitle,
  score,
  maxScore,
}) {
  const resend = getClient();

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "EduEval AI <onboarding@resend.dev>",
    to,
    subject: `Votre note pour « ${evaluationTitle} » est disponible`,
    html: `
      <p>Bonjour ${firstName},</p>
      <p>Votre évaluation « ${evaluationTitle} » a été corrigée par votre enseignant.</p>
      <p style="font-size: 18px;"><strong>Note obtenue : ${score} / ${maxScore}</strong></p>
      <p>— EduEval AI</p>
    `,
  });
}

module.exports = {
  sendResultsPublishedEmail,
};
