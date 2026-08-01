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

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
}));

const fs = require("node:fs/promises");
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const storageService = require("../storage.service");

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockSend.mockReset();
  fs.readFile.mockReset();
  process.env = { ...ORIGINAL_ENV };
  process.env.S3_ENDPOINT = "https://project-ref.supabase.co/storage/v1/s3";
  process.env.S3_ACCESS_KEY_ID = "key123";
  process.env.S3_SECRET_ACCESS_KEY = "secret123";
  process.env.S3_BUCKET_NAME = "bucket-test";
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

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
  it("rejette si les identifiants S3 sont absents", async () => {
    delete process.env.S3_ENDPOINT;
    fs.readFile.mockResolvedValue(Buffer.from("data"));

    await expect(
      storageService.uploadFile("/tmp/x", "key", "application/pdf")
    ).rejects.toThrow(/S3_ENDPOINT/);
  });

  it("envoie le contenu du fichier local vers le stockage objet", async () => {
    fs.readFile.mockResolvedValue(Buffer.from("contenu"));
    mockSend.mockResolvedValue({});

    await storageService.uploadFile(
      "/tmp/x",
      "answers/1/2/file.pdf",
      "application/pdf"
    );

    expect(fs.readFile).toHaveBeenCalledWith("/tmp/x");
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: "bucket-test",
      Key: "answers/1/2/file.pdf",
      Body: Buffer.from("contenu"),
      ContentType: "application/pdf",
    });
  });

  it("utilise un type de contenu par défaut si absent", async () => {
    fs.readFile.mockResolvedValue(Buffer.from("contenu"));
    mockSend.mockResolvedValue({});

    await storageService.uploadFile("/tmp/x", "key", undefined);

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "application/octet-stream" })
    );
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
