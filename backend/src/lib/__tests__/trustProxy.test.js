const express = require("express");
const request = require("supertest");

const { TRUSTED_PROXIES } = require("../trustProxy");

// Les tests se connectent depuis la boucle locale (proxy de confiance), comme
// le sidecar local de Render devant l'application.
function buildApp() {
  const app = express();

  app.set("trust proxy", TRUSTED_PROXIES);
  app.get("/ip", (req, res) => res.json({ ip: req.ip }));

  return app;
}

async function clientIpFor(forwardedFor) {
  const call = request(buildApp()).get("/ip");

  if (forwardedFor) {
    call.set("X-Forwarded-For", forwardedFor);
  }

  return (await call).body.ip;
}

const REAL_CLIENT = "41.208.141.177";
const CLOUDFLARE = "104.23.243.174";
const RENDER_INTERNAL = "10.27.210.232";

describe("trust proxy (Render derrière Cloudflare)", () => {
  it("retient l'IP réelle du client avec la chaîne mesurée en production", async () => {
    expect(
      await clientIpFor(`${REAL_CLIENT}, ${CLOUDFLARE}, ${RENDER_INTERNAL}`)
    ).toBe(REAL_CLIENT);
  });

  it("ignore un X-Forwarded-For falsifié par le client", async () => {
    expect(
      await clientIpFor(
        `1.2.3.4,${REAL_CLIENT}, ${CLOUDFLARE}, ${RENDER_INTERNAL}`
      )
    ).toBe(REAL_CLIENT);
  });

  it("ignore aussi une fausse adresse privée ou Cloudflare ajoutée par le client", async () => {
    expect(
      await clientIpFor(
        `10.0.0.1, 104.16.0.1, ${REAL_CLIENT}, ${CLOUDFLARE}, ${RENDER_INTERNAL}`
      )
    ).toBe(REAL_CLIENT);
  });

  it("reste correct si un saut interne est ajouté ou retiré", async () => {
    expect(await clientIpFor(`${REAL_CLIENT}, ${RENDER_INTERNAL}`)).toBe(
      REAL_CLIENT
    );
    expect(
      await clientIpFor(
        `${REAL_CLIENT}, ${CLOUDFLARE}, 10.1.1.1, ${RENDER_INTERNAL}`
      )
    ).toBe(REAL_CLIENT);
  });

  it("gère un client IPv6 derrière une adresse IPv6 de Cloudflare", async () => {
    expect(
      await clientIpFor(
        `2001:4278:15:57d9:b17c:d893:ceae:5be9, 2a06:98c0::1, ${RENDER_INTERNAL}`
      )
    ).toBe("2001:4278:15:57d9:b17c:d893:ceae:5be9");
  });

  it("sans en-tête, retient l'adresse de la connexion (développement local)", async () => {
    expect(await clientIpFor(null)).toMatch(/127\.0\.0\.1|::1/);
  });

  it("une adresse Cloudflare hors liste est prise pour le client (panne sûre : compteur partagé, jamais falsifiable)", async () => {
    expect(
      await clientIpFor(`${REAL_CLIENT}, 8.8.8.8, ${RENDER_INTERNAL}`)
    ).toBe("8.8.8.8");
  });
});
