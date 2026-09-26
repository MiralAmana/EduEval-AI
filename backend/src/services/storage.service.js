const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const UPLOAD_MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Un client par configuration, réutilisé d'un appel à l'autre : en créer un
// nouveau à chaque appel recréait à chaque fois un pool de connexions HTTP
// (donc une nouvelle poignée de main TLS par fichier).
const clients = new Map();

// Fonctionne avec n'importe quel stockage compatible S3 (Supabase
// Storage, Cloudflare R2, MinIO, AWS S3...) : seuls l'endpoint et les
// identifiants changent d'un fournisseur à l'autre.
//
// `singleAttempt` : client sans réessai automatique du SDK, réservé aux
// dépôts. Le corps d'un dépôt est un flux lu depuis le disque : une fois
// consommé par un premier essai, le SDK ne pourrait pas le renvoyer. Les
// réessais sont faits par uploadFile, avec un nouveau flux à chaque fois.
function getClient({ singleAttempt = false } = {}) {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Les variables S3_ENDPOINT, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY sont requises dans backend/.env."
    );
  }

  const region = process.env.S3_REGION || "us-east-1";
  const cacheKey = [
    endpoint,
    accessKeyId,
    secretAccessKey,
    region,
    singleAttempt,
  ].join("|");

  if (!clients.has(cacheKey)) {
    clients.set(
      cacheKey,
      new S3Client({
        region,
        endpoint,
        // Requis par Supabase Storage (et la plupart des fournisseurs hors
        // AWS) : adressage par chemin plutôt que par sous-domaine de bucket.
        forcePathStyle: true,
        // Le SDK récent ajoute par défaut un checksum à chaque requête ; pour
        // un flux, il passerait par un encodage "aws-chunked" avec trailer que
        // beaucoup de stockages compatibles S3 refusent. On ne le demande que
        // quand le service l'exige.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        ...(singleAttempt ? { maxAttempts: 1 } : {}),
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    );
  }

  return clients.get(cacheKey);
}

function getBucketName() {
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error(
      "La variable S3_BUCKET_NAME est absente du fichier backend/.env."
    );
  }

  return bucket;
}

/**
 * Construit une clé d'objet lisible et stable pour la réponse d'un
 * étudiant à une question donnée. Le nom d'origine est conservé côté
 * base de données (colonne fileName) pour l'affichage/téléchargement ;
 * la clé n'a pas besoin de rester lisible ni de rester secrète, l'accès
 * est déjà contrôlé par la vérification de propriété en base.
 */
function buildAnswerObjectKey(attemptId, questionId, fileName) {
  const extension = path.extname(fileName || "");

  return `answers/${attemptId}/${questionId}/${Date.now()}${extension}`;
}

// Erreur passagère (réseau, surcharge du service) : on réessaie. Une erreur
// 4xx (accès refusé, mauvais bucket…) ne changera pas au deuxième essai.
function isRetryableUploadError(error) {
  const status = error?.$metadata?.httpStatusCode;

  return !status || status >= 500 || status === 408 || status === 429;
}

/**
 * Envoie un fichier local vers le stockage en le LISANT EN FLUX depuis le
 * disque, sans jamais le charger en entier en mémoire : avec l'ancien
 * `readFile`, chaque dépôt en cours gardait tout son fichier en RAM (40
 * dépôts de 9 Mo faisaient passer le serveur de 160 à 500 Mo).
 */
async function uploadFile(localFilePath, objectKey, contentType) {
  // Configuration d'abord : une variable manquante doit être signalée telle
  // quelle, pas masquée par une autre erreur.
  const client = getClient({ singleAttempt: true });
  const bucket = getBucketName();

  // Le SDK a besoin de la taille à l'avance pour envoyer un flux.
  const { size } = await fs.stat(localFilePath);
  const retryBaseMs = Number(process.env.S3_RETRY_BASE_MS ?? 500);

  for (let attempt = 1; ; attempt += 1) {
    const body = fsSync.createReadStream(localFilePath);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: body,
          ContentLength: size,
          ContentType: contentType || "application/octet-stream",
        })
      );

      return objectKey;
    } catch (error) {
      body.destroy();

      if (attempt >= UPLOAD_MAX_ATTEMPTS || !isRetryableUploadError(error)) {
        throw error;
      }

      await sleep(retryBaseMs * 2 ** (attempt - 1));
    }
  }
}

async function downloadFileBuffer(objectKey) {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
    })
  );

  return Buffer.from(await result.Body.transformToByteArray());
}

async function deleteFile(objectKey) {
  await getClient()
    .send(
      new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey,
      })
    )
    .catch(() => {});
}

module.exports = {
  buildAnswerObjectKey,
  uploadFile,
  downloadFileBuffer,
  deleteFile,
};
