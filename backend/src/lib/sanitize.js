function sanitizeQuestionForStudent(question) {
  const { correctAnswer, choices, ...rest } = question;

  return {
    ...rest,
    choices: (choices || []).map(({ correct, ...choice }) => choice),
  };
}

function sanitizeQuestionsForStudent(questions) {
  return (questions || []).map(sanitizeQuestionForStudent);
}

module.exports = {
  sanitizeQuestionForStudent,
  sanitizeQuestionsForStudent,
};
