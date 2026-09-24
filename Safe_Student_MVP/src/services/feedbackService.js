/**
 * Remove campos legados de identificação antes de exibir avaliações acadêmicas.
 */
function feedbackView(feedback) {
  const { userId: ignoredLegacyUserId, ...anonymous } = feedback;
  void ignoredLegacyUserId;
  return anonymous;
}

module.exports = { feedbackView };
