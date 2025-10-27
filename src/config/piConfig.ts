/**
 * Raspberry Pi Configuration
 *
 * Update PI_IP_ADDRESS with your actual Raspberry Pi IP
 */

export const PI_CONFIG = {
  // Change this to your Raspberry Pi's actual IP address
  IP_ADDRESS: '10.40.255.34',

  // Port where Flask server runs
  PORT: 5000,

  // Request timeout in milliseconds
  TIMEOUT: 3000,

  // Connection check interval in milliseconds
  PING_INTERVAL: 5000,
};

export const getApiBaseUrl = () => {
  return `http://${PI_CONFIG.IP_ADDRESS}:${PI_CONFIG.PORT}`;
};

export const getPiStatus = () => {
  return {
    url: getApiBaseUrl(),
    ip: PI_CONFIG.IP_ADDRESS,
    port: PI_CONFIG.PORT,
  };
};
