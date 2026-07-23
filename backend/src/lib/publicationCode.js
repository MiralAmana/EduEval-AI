const prisma = require("./prisma");

const CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = 6) {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(
      Math.random() * CODE_CHARACTERS.length
    );

    code += CODE_CHARACTERS[randomIndex];
  }

  return code;
}

async function generateUniqueCode() {
  let code = generateCode();

  while (
    await prisma.publication.findUnique({
      where: { code },
      select: { id: true },
    })
  ) {
    code = generateCode();
  }

  return code;
}

module.exports = {
  generateUniqueCode,
};
