const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

// Le pool par défaut de pg (10 connexions) se sature quand des dizaines
// d'élèves soumettent en même temps : les transactions ne trouvent plus de
// connexion libre à temps (Prisma P2028). 20 laisse de la marge tout en
// restant très en dessous des limites d'un Postgres managé (Neon, etc.) ;
// à ajuster via DATABASE_POOL_SIZE si le plan de la base le permet.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_SIZE) || 20,
});

const prisma = new PrismaClient({
  adapter,

  // Attente maximale d'une connexion pour démarrer une transaction (2 s par
  // défaut, trop court en pic de charge) et durée maximale d'une transaction.
  transactionOptions: {
    maxWait: 15000,
    timeout: 30000,
  },
});

module.exports = prisma;
