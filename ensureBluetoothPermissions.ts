import { 
  PERMISSIONS, 
  requestMultiple, 
  RESULTS 
} from 'react-native-permissions';
import { Platform } from 'react-native';

export async function ensureBluetoothPermissions() {
  if (Platform.OS === 'android') {
    const result = await requestMultiple([
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
      PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
      PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
    ]);

    console.log("Permission results:", result);

    // ตรวจสอบว่า granted หมดหรือยัง
    const denied = Object.entries(result).filter(
      ([, status]) => status !== RESULTS.GRANTED
    );

    if (denied.length === 0) {
      console.log("✅ All bluetooth permissions granted");
      return true;
    } else {
      console.warn("⚠️ Some permissions denied:", denied);
      return false;
    }
  }
  return true; // iOS หรือ platform อื่นไม่ต้องขอ
}
