const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

const {
  sendResultsPublishedEmail,
  sendPasswordResetEmail,
} = require("../email.service");

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockSend.mockReset().mockResolvedValue({});
  process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "test-key" };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("sendResultsPublishedEmail", () => {
  it("échappe le HTML du prénom et du titre dans le corps de l'email", async () => {
    await sendResultsPublishedEmail({
      to: "eleve@example.com",
      firstName: '<img src=x onerror="alert(1)">',
      evaluationTitle: "<a href='http://evil.example'>Clique</a>",
      score: 12,
      maxScore: 20,
    });

    const { html } = mockSend.mock.calls[0][0];

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a href='http://evil.example'>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("12 / 20");
  });
});

describe("sendPasswordResetEmail", () => {
  it("échappe le prénom et conserve un lien de réinitialisation fonctionnel", async () => {
    await sendPasswordResetEmail({
      to: "prof@example.com",
      firstName: "<script>alert(1)</script>",
      resetLink: "https://app.example/reset-password?token=abc123",
    });

    const { html } = mockSend.mock.calls[0][0];

    expect(html).not.toContain("<script>");
    expect(html).toContain(
      'href="https://app.example/reset-password?token=abc123"'
    );
  });
});
