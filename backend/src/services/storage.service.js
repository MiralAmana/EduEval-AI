const fs = require("node:fs/promises");
const path = require("node:path");

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

// Fonctionne avec n'importe quel stockage compatible S3 (Supabase
// Storage, Cloudflare R2, MinIO, AWS S3...) : seuls l'endpoint et les
// identifiants changent d'un fournisseur à l'autre.
function getClient() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Les variables S3_ENDPOINT, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY sont requises dans backend/.env."
    );
  }

  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint,
    // Requis par Supabase Storage (et la plupart des fournisseurs hors
    // AWS) : adressage par chemin plutôt que par sous-domaine de bucket.
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
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

async function uploadFile(localFilePath, objectKey, contentType) {
  const body = await fs.readFile(localFilePath);

  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );

  return objectKey;
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
