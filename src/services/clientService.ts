import apiClient from './apiClient';

export interface Client {
  id: string;
  name: string;
  user_id: string;
  summary_template: string;
  created_at: string;
}

/**
 * Récupère la liste des clients disponibles avec leurs templates
 * @returns Liste des clients avec leurs IDs, noms et templates
 */
export async function getClients(): Promise<Client[]> {
  try {
    console.log('Fetching available clients');
    
    // Appel à l'API pour récupérer la liste des clients
    // Endpoint exact selon la documentation: GET /clients/
    const clients = await apiClient.get<Client[]>('/clients');
    
    console.log(`Retrieved ${clients.length} clients`);
    return clients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }
}

/**
 * Associe une réunion à un client spécifique
 * @param meetingId ID de la réunion
 * @param clientId ID du client (ou null pour utiliser le template par défaut)
 * @returns La réunion mise à jour
 */
export async function associateMeetingWithClient(meetingId: string, clientId: string | null): Promise<any> {
  try {
    console.log(`Associating meeting ${meetingId} with client ${clientId || 'default template'}`);
    
    // Appel à l'API pour associer la réunion au client
    // Endpoint exact selon la documentation: PUT /meetings/{meeting_id}
    const response = await apiClient.put(`/meetings/${meetingId}`, {
      client_id: clientId
    });
    
    console.log('Meeting association updated successfully');
    return response;
  } catch (error) {
    console.error(`Error associating meeting ${meetingId} with client:`, error);
    throw error;
  }
}
