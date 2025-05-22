// Étape 2: Générer le résumé
try {
  // Message utilisateur pour informer que l'opération peut être longue
  console.log(`Étape 2: Génération du résumé pour la réunion ${meetingId}`);
  console.log('La génération du résumé peut prendre quelques instants, veuillez patienter...');
  
  // Essayer une approche différente selon la documentation fournie
  // Selon la doc: Étape 2 : Lancer la génération du résumé via POST /meetings/{meeting_id}/generate-summary
  // IMPORTANT: Ne pas envoyer de payload pour le template par défaut
  
  // Envoyer la requête de génération du résumé
  const generateEndpoint = `/meetings/${meetingId}/generate-summary`;
  console.log(`Envoi de la requête à l'endpoint: ${generateEndpoint}`);
  
  try {
    data = await apiClient.post(generateEndpoint);
    console.log('Réponse API de génération de résumé:', data);
  } catch (genErr) {
    console.error('Erreur lors de l\'appel génération avec generate-summary:', genErr);
    
    // Si l'endpoint /generate-summary échoue, essayons avec /summary
    try {
      console.log('Tentative avec l\'endpoint alternatif /summary...');
      const summaryEndpoint = `/meetings/${meetingId}/summary`;
      data = await apiClient.post(summaryEndpoint);
      console.log('Réponse API de l\'endpoint alternatif:', data);
    } catch (altErr) {
      console.error('Erreur avec l\'endpoint alternatif:', altErr);
      throw new Error(`Échec de génération du résumé avec les deux endpoints: ${altErr.status || altErr.message}`);
    }
  }
} catch (err) {
  console.error('Erreur lors de la génération du résumé:', err);
  throw new Error(`Erreur lors de la génération du résumé: ${err.message}`);
}
