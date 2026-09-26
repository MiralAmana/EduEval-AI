const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn((input) => ({ __type: "PutObjectCommand", input })),
  GetObjectCommand: jest.fn((input) => ({ __type: "GetObjectCommand", input })),
  DeleteObjectCommand: jest.fn((input) => ({
    __type: "DeleteObjectCommand",
    input,
  })),
}));

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const storageService = require("../storage.service");

const ORIGINAL_ENV = { ...process.env };

let tmpDir;
let localFile;

beforeEach(() => {
  mockSend.mockReset();
  S3Client.mockClear();
  PutObjectCommand.mockClear();
  process.env = { ...ORIGINAL_ENV };
  process.env.S3_ENDPOINT = "https://project-ref.supabase.co/storage/v1/s3";
  process.env.S3_ACCESS_KEY_ID = "key123";
  process.env.S3_SECRET_ACCESS_KEY = "secret123";
  process.env.S3_BUCKET_NAME = "bucket-test";
  process.env.S3_RETRY_BASE_MS = "0";

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "storage-test-"));
  localFile = path.join(tmpDir, "devoir.bin");
  fs.writeFileSync(localFile, Buffer.from("contenu du fichier"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});


// Comme le vrai SDK : lit le flux du corps jusqu'au bout avant de répondre
// (ou d'échouer), ce qui ferme le fichier.
function sdkSends(...outcomes) {
  let call = 0;

  return async (command) => {
    if (command.input.Body?.pipe) {
      // eslint-disable-next-line no-unused-vars
      for await (const chunk of command.input.Body) {
        // lu jusqu'au bout
      }
    }

    const outcome = outcomes[Math.min(call, outcomes.length - 1)];
    call += 1;

    return outcome();
  };
}

const succeeds = () => ({});
const failsWith = (error) => () => {
  throw error;
};

async function readAll(stream) {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

describe("buildAnswerObjectKey", () => {
  it("construit une clé avec l'extension du fichier d'origine", () => {
    const key = storageService.buildAnswerObjectKey(
      "attempt-1",
      "q-1",
      "devoir.pdf"
    );

    expect(key).toMatch(/^answers\/attempt-1\/q-1\/\d+\.pdf$/);
  });
});

describe("uploadFile", () => {
  it("rejette si les identifiants S3 sont absents, même si le fichier n'existe pas", async () => {
    delete process.env.S3_ENDPOINT;

    await expect(
      storageService.uploadFile("/n/existe/pas", "key", "application/pdf")
    ).rejects.toThrow(/S3_ENDPOINT/);
  });

  it("envoie le fichier en FLUX (pas en Buffer) avec sa taille, sans le charger en mémoire", async () => {
    mockSend.mockResolvedValue({});

    await storageService.uploadFile(
      localFile,
      "answers/1/2/file.pdf",
      "application/pdf"
    );

    expect(mockSend).toHaveBeenCalledTimes(1);

    const input = PutObjectCommand.mock.calls[0][0];

    expect(input).toMatchObject({
      Bucket: "bucket-test",
      Key: "answers/1/2/file.pdf",
      ContentType: "application/pdf",
      ContentLength: Buffer.byteLength("contenu du fichier"),
    });
    expect(Buffer.isBuffer(input.Body)).toBe(false);
    expect(typeof input.Body.pipe).toBe("function");
    expect((await readAll(input.Body)).toString()).toBe("contenu du fichier");
  });

  it("utilise un type de contenu par défaut si absent", async () => {
    mockSend.mockImplementation(sdkSends(succeeds));

    await storageService.uploadFile(localFile, "key", undefined);

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "application/octet-stream" })
    );
  });

  it("réutilise le même client S3 d'un envoi à l'autre (pas de nouveau pool de connexions par fichier)", async () => {
    mockSend.mockImplementation(sdkSends(succeeds));

    // Module neuf : le cache de clients repart de zéro.
    let freshService;
    let FreshS3Client;

    jest.isolateModules(() => {
      FreshS3Client = require("@aws-sdk/client-s3").S3Client;
      freshService = require("../storage.service");
    });

    await freshService.uploadFile(localFile, "k1", "application/pdf");
    await freshService.uploadFile(localFile, "k2", "application/pdf");
    await freshService.uploadFile(localFile, "k3", "application/pdf");

    expect(FreshS3Client).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("demande un client sans réessai automatique du SDK et sans checksum imposé", async () => {
    delete process.env.S3_REGION;
    process.env.S3_ENDPOINT = "https://autre.example.com/s3"; // nouvelle configuration
    mockSend.mockImplementation(sdkSends(succeeds));

    await storageService.uploadFile(localFile, "key", "application/pdf");

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        maxAttempts: 1,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        forcePathStyle: true,
      })
    );
  });

  it("réessaie une erreur passagère avec un NOUVEAU flux à chaque essai", async () => {
    const seenBodies = [];

    mockSend.mockImplementation(
      sdkSends(
        failsWith(new Error("réseau")),
        failsWith(
          Object.assign(new Error("indisponible"), {
            $metadata: { httpStatusCode: 503 },
          })
        ),
        succeeds
      )
    );
    PutObjectCommand.mockImplementation((input) => {
      seenBodies.push(input.Body);

      return { __type: "PutObjectCommand", input };
    });

    await storageService.uploadFile(localFile, "key", "application/pdf");

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(new Set(seenBodies).size).toBe(3); // trois flux distincts
    expect(seenBodies[0].destroyed).toBe(true); // les flux abandonnés sont fermés

    PutObjectCommand.mockImplementation((input) => ({
      __type: "PutObjectCommand",
      input,
    }));
  });

  it("ne réessaie pas une erreur définitive (403 accès refusé)", async () => {
    mockSend.mockImplementation(
      sdkSends(
        failsWith(
          Object.assign(new Error("AccessDenied"), {
            $metadata: { httpStatusCode: 403 },
          })
        )
      )
    );

    await expect(
      storageService.uploadFile(localFile, "key", "application/pdf")
    ).rejects.toThrow("AccessDenied");
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("abandonne après 3 essais sur une panne persistante", async () => {
    mockSend.mockImplementation(
      sdkSends(
        failsWith(
          Object.assign(new Error("panne"), {
            $metadata: { httpStatusCode: 500 },
          })
        )
      )
    );

    await expect(
      storageService.uploadFile(localFile, "key", "application/pdf")
    ).rejects.toThrow("panne");
    expect(mockSend).toHaveBeenCalledTimes(3);
  });
});

describe("downloadFileBuffer", () => {
  it("renvoie le contenu de l'objet sous forme de Buffer", async () => {
    mockSend.mockResolvedValue({
      Body: {
        transformToByteArray: jest
          .fn()
          .mockResolvedValue(new Uint8Array([1, 2, 3])),
      },
    });

    const result = await storageService.downloadFileBuffer(
      "answers/1/2/file.pdf"
    );

    expect(result).toEqual(Buffer.from([1, 2, 3]));
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: "bucket-test",
      Key: "answers/1/2/file.pdf",
    });
  });
});

describe("deleteFile", () => {
  it("supprime l'objet sur le stockage", async () => {
    mockSend.mockResolvedValue({});

    await storageService.deleteFile("answers/1/2/file.pdf");

    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: "bucket-test",
      Key: "answers/1/2/file.pdf",
    });
  });

  it("ne rejette pas si la suppression échoue (best effort)", async () => {
    mockSend.mockRejectedValue(new Error("not found"));

    await expect(
      storageService.deleteFile("answers/1/2/file.pdf")
    ).resolves.toBeUndefined();
  });
});
