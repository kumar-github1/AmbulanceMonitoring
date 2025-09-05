// Server Configuration
export const SERVER_CONFIG = {
  // Set to true to enable offline mode (no server required)
  OFFLINE_MODE: true,
  
  // WebSocket server URLs (change to your server's IP)
  SOCKET_URL: 'ws://10.144.117.52:3001',
  API_BASE_URL: 'http://10.0.2.2:3000',
  
  // Connection settings
  CONNECTION_TIMEOUT: 5000,
  RECONNECTION_ATTEMPTS: 3,
  
  // Fallback to offline mode if server is unavailable
  ENABLE_OFFLINE_FALLBACK: true,
};

// Helper to get the appropriate server URL based on environment
export const getSocketUrl = (): string => {
  if (SERVER_CONFIG.OFFLINE_MODE) {
    return ''; // Empty URL will skip connection
  }
  return SERVER_CONFIG.SOCKET_URL;
};

export const getApiUrl = (): string => {
  if (SERVER_CONFIG.OFFLINE_MODE) {
    return ''; // Empty URL will skip API calls
  }
  return SERVER_CONFIG.API_BASE_URL;
};