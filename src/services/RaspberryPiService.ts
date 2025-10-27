import { getApiBaseUrl, PI_CONFIG } from '../config/piConfig';

const API_BASE = getApiBaseUrl();

let isConnected = false;
let lastPingTime = 0;

export const checkConnection = async (): Promise<boolean> => {
  const now = Date.now();
  if (now - lastPingTime < PI_CONFIG.PING_INTERVAL) {
    return isConnected;
  }

  try {
    const response = await fetch(`${API_BASE}/signals`, {
      method: 'GET',
      timeout: PI_CONFIG.TIMEOUT,
    } as any);
    isConnected = response.ok;
    lastPingTime = now;
    if (isConnected) {
      console.log(`✅ Pi connected at ${API_BASE}`);
    }
    return isConnected;
  } catch (error) {
    isConnected = false;
    lastPingTime = now;
    console.warn(`⚠️  Pi connection lost (${API_BASE})`);
    return false;
  }
};

export const updateSignal = async (signalId: string, status: 'green' | 'red'): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/signal/${signalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
      timeout: PI_CONFIG.TIMEOUT,
    } as any);

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Pi signal ${signalId} → ${status.toUpperCase()}`, data);
      return true;
    } else {
      console.error(`❌ Pi signal ${signalId} failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Pi signal ${signalId} update failed:`, error);
    return false;
  }
};

export const updateSignalDirection = async (
  signalId: string,
  direction: 'north_south' | 'east_west' | 'all_directions',
  status: 'green' | 'red'
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/signal/${signalId}/direction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, status }),
      timeout: PI_CONFIG.TIMEOUT,
    } as any);

    if (response.ok) {
      const data = await response.json();
      if (data.skipped) {
        console.log(`⏭️  Pi signal ${signalId} skipped: direction mismatch`);
      } else {
        console.log(`✅ Pi signal ${signalId} [${direction}] → ${status.toUpperCase()}`, data);
      }
      return true;
    } else {
      console.error(`❌ Pi signal ${signalId} direction failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Pi signal ${signalId} direction update failed:`, error);
    return false;
  }
};

export const getAmbulanceDirection = (heading: number): 'north_south' | 'east_west' => {
  const normalized = ((heading % 360) + 360) % 360;
  if ((normalized >= 315 || normalized < 45) || (normalized >= 135 && normalized < 225)) {
    return 'north_south';
  }
  return 'east_west';
};

export const syncAllSignalsWithPi = async (signals: Array<{id: string, status: 'green' | 'red'}>) => {
  try {
    await fetch(`${API_BASE}/signals/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signals }),
    });
    console.log(`✅ Synced ${signals.length} signals with Pi`);
  } catch (error) {
    console.error('❌ Pi sync failed:', error);
  }
};

export const fetchPiSignalStatus = async (signalId: string) => {
  try {
    const response = await fetch(`${API_BASE}/signal/${signalId}/status`);
    return await response.json();
  } catch (error) {
    console.error(`❌ Pi status fetch failed for ${signalId}:`, error);
    return null;
  }
};

export default updateSignal;
