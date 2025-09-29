import React, {useRef, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  NativeModules,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {captureRef} from 'react-native-view-shot';


const COLORS = {
  primary: '#007AFF', 
  secondary: '#FF3B30', 
  background: '#F0F2F5', 
  card: '#FFFFFF', 
  text: '#1C1C1E', 
  subText: '#8E8E93',
  success: '#34C759', 
  action: '#FF9500', 
};

const {RNPrinterModule} = NativeModules;

interface BleDevice {
  name: string;
  address: string;
}


const TestCommandList: React.FC<{
  connectedAddress: string;
  setLoading: (loading: boolean) => void;
  loading: boolean;
}> = ({connectedAddress, setLoading, loading}) => {
  const previewRef = useRef<View>(null);

  const testPrint = async () => {
    setLoading(true);
    try {
      await RNPrinterModule.testPrintSampleTicket();
      Alert.alert('Print Success', 'Test print completed.');
    } catch (e) {
      console.error(e);
      Alert.alert('Print Failed', 'Could not complete test print.');
    }
    setLoading(false);
  };

  const printPreviewImage = async () => {
    if (!previewRef.current) return;
    setLoading(true);
    try {
      const base64Image = await captureRef(previewRef, {
        format: 'png',
        quality: 1,
        result: 'base64',
        width: 384, 
      });

      await RNPrinterModule.printImageFromBase64(base64Image);
      Alert.alert('Print Success', 'Image sent to printer.');
    } catch (e) {
      console.error('Image print failed', e);
      Alert.alert('Print Failed', 'Could not print image.');
    }
    setLoading(false);
  };

  const commands = [
    {id: 'test', name: 'Print Sample Ticket', action: testPrint},
    {id: 'image', name: 'Print Preview Image', action: printPreviewImage},
  ];

  const renderCommandItem = ({item}: {item: any}) => (
    <TouchableOpacity
      style={[styles.commandCard, loading && styles.commandDisabled]}
      onPress={item.action}
      disabled={loading}>
      <Text style={styles.commandName}>{item.name}</Text>
      <Text style={styles.commandArrow}>&gt;</Text>
    </TouchableOpacity>
  );

  const ReceiptPreview = () => (
    <View
      ref={previewRef}
      collapsable={false}
      style={styles.receiptContainer}>
      {/* ส่วนหัวใบเสร็จ */}
      <View style={styles.receiptHeader}>
        <Text style={styles.receiptStoreName}>THE PRINT SHOP 🧾</Text>
        <Text style={styles.receiptInfo}>
          Date: 29/09/2025 | Time: 14:30
        </Text>
        <Text style={styles.receiptInfo}>Order No: #BKK-001234</Text>
        <Text style={styles.receiptInfo}>ปริ้นโดย : นาย วัจน์กร จันทรา หัวหน้ายาม</Text>

      </View>

      {/* เส้นแบ่ง */}
      <Text style={styles.receiptSeparator}>
        ----------------------------------
      </Text>

      {/* รายการสินค้า */}
      <View style={styles.receiptItemRow}>
        <Text style={styles.receiptItemText}>1 x Coffee Latte</Text>
        <Text style={styles.receiptItemPrice}>75.00</Text>
      </View>
      <View style={styles.receiptItemRow}>
        <Text style={styles.receiptItemText}>2 x Croissant</Text>
        <Text style={styles.receiptItemPrice}>110.00</Text>
      </View>
      <View style={styles.receiptItemRow}>
        <Text style={styles.receiptItemText}>1 x Water Bottle</Text>
        <Text style={styles.receiptItemPrice}>20.00</Text>
      </View>

      {/* เส้นแบ่ง */}
      <Text style={styles.receiptSeparator}>
        ----------------------------------
      </Text>

      {/* ยอดรวมย่อย */}
      <View style={styles.receiptSummaryRow}>
        <Text style={styles.receiptSummaryLabel}>Subtotal</Text>
        <Text style={styles.receiptSummaryValue}>205.00</Text>
      </View>
      <View style={styles.receiptSummaryRow}>
        <Text style={styles.receiptSummaryLabel}>Service Charge (10%)</Text>
        <Text style={styles.receiptSummaryValue}>20.50</Text>
      </View>

      {/* เส้นแบ่ง */}
      <Text style={styles.receiptSeparator}>
        ==================================
      </Text>

      {/* ยอดรวมสุทธิ */}
      <View style={styles.receiptTotalRow}>
        <Text style={styles.receiptTotalLabel}>TOTAL DUE</Text>
        <Text style={styles.receiptTotalValue}>225.50</Text>
      </View>

      {/* ส่วนท้าย */}
      <View style={styles.receiptFooter}>
        <Text style={styles.receiptFooterText}>
          Thank you for your visit! 🙏
        </Text>
        <Text style={styles.receiptFooterText}>Powered by RNPrinterModule</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.commandListContainer}>
      <Text style={styles.listTitle}>Printer Commands</Text>
      <Text style={styles.listTitleSmall}>
        (Image width for capture is 384px)
      </Text>

      {/* แสดงตัวอย่าง preview image ที่ปรับปรุงแล้ว */}
      <ReceiptPreview />

      {/* List ของคำสั่ง */}
      <FlatList
        data={commands}
        keyExtractor={item => item.id}
        renderItem={renderCommandItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};



export default function App() {
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // --- Functions (Unchanged) ---
  const scanDevices = async () => {
    if (isScanning) return;
    setLoading(true);
    setIsScanning(true);
    setDevices([]);
    try {
      const found: BleDevice[] = await RNPrinterModule.scanBleDevice();
      setDevices(found);
    } catch (e) {
      console.error('Scan failed', e);
      Alert.alert(
        'Scan Failed',
        'Could not scan for BLE devices. Check permissions.',
      );
    }
    setLoading(false);
    setIsScanning(false);
  };

  const connectDevice = async (device: BleDevice) => {
    if (connectedDevice === device.address) {
      Alert.alert('Already Connected', `${device.name} is already connected.`);
      return;
    }
    setLoading(true);
    try {
      await RNPrinterModule.connectBleDevice(device.address);
      setConnectedDevice(device.address);
      Alert.alert(
        'Connected',
        `Successfully connected to ${device.name || 'Device'}`,
      );
    } catch (e) {
      console.error('Connect failed', e);
      Alert.alert(
        'Connection Failed',
        `Could not connect to ${device.name || 'Device'}.`,
      );
    }
    setLoading(false);
  };

  const disconnectDevice = async () => {
    setLoading(true);
    try {
      await RNPrinterModule.disconnectBleDevice();
      setConnectedDevice(null);
      Alert.alert('Disconnected', 'Device successfully disconnected.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not disconnect the device.');
    }
    setLoading(false);
  };

  // --- Components (Unchanged) ---
  const renderDeviceItem = ({item}: {item: BleDevice}) => {
    const isConnected = connectedDevice === item.address;
    const isDisabled = loading || isScanning;

    return (
      <TouchableOpacity
        style={[styles.deviceCard, isConnected && styles.connectedCard]}
        onPress={() => connectDevice(item)}
        disabled={isDisabled || isConnected}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName} numberOfLines={1}>
            {item.name || 'N/A'}
          </Text>
          <Text style={styles.deviceAddress} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        <View style={styles.statusBadgeContainer}>
          {isConnected ? (
            <Text style={styles.connectedBadge}>CONNECTED</Text>
          ) : (
            <Text style={styles.connectText}>Connect</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => {
    if (isScanning) {
      return null;
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No devices found. Tap 'Scan' to search.
        </Text>
      </View>
    );
  };

  // --- Main Render (Unchanged) ---

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BLE Printer Connect</Text>
      </View>

      {/* ภาวะที่เชื่อมต่อแล้ว (Connected State) */}
      {connectedDevice ? (
        <TestCommandList
          connectedAddress={connectedDevice}
          setLoading={setLoading}
          loading={loading}
        />
      ) : (
        // ภาวะที่ยังไม่ได้เชื่อมต่อ (Disconnected State)
        <>
          {/* Scan Button & Indicator */}
          <View style={styles.scanButtonContainer}>
            <TouchableOpacity
              style={[
                styles.scanButton,
                (loading || isScanning) && styles.scanButtonDisabled,
              ]}
              onPress={scanDevices}
              disabled={loading || isScanning}>
              {isScanning ? (
                <ActivityIndicator color={COLORS.card} />
              ) : (
                <Text style={styles.scanButtonText}>Scan for Devices</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Device List */}
          <Text style={styles.listTitle}>Found Devices</Text>
          <FlatList
            data={devices}
            keyExtractor={item => item.address}
            renderItem={renderDeviceItem}
            ListEmptyComponent={renderEmptyList}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}

      {/* Disconnect Footer (แสดงทุกครั้งที่ connectedDevice มีค่า) */}
      {connectedDevice && (
        <View style={styles.footer}>
          <View style={styles.connectionStatus}>
            <Text style={styles.statusLabel}>Connected:</Text>
            <Text style={styles.statusAddress}>{connectedDevice}</Text>
          </View>

          {/* Disconnect Button อย่างเดียว */}
          <TouchableOpacity
            style={[
              styles.disconnectButton,
              loading && styles.disconnectButtonDisabled, // ใช้ style สำหรับปุ่ม disconnect
            ]}
            onPress={disconnectDevice}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.card} />
            ) : (
              <Text style={styles.disconnectButtonText}>Disconnect</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Global Loading Overlay */}
      {loading && !isScanning && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

// -----------------------------------------------------------
// 3. Stylesheet ที่เพิ่ม/ปรับปรุง
// -----------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 15,
    paddingTop: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },

  // --- Scan Button ---
  scanButtonContainer: {
    padding: 15,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '90%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  scanButtonDisabled: {
    backgroundColor: COLORS.subText,
    shadowOpacity: 0,
    elevation: 0,
  },
  scanButtonText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: '600',
  },

  // --- List & Card Styles ---
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 15,
    marginBottom: 5,
  },
  listTitleSmall: { // เพิ่ม style สำหรับคำอธิบาย
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.subText,
    paddingHorizontal: 15,
    marginBottom: 5,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    padding: 15,
    marginVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#EBEBEB',
  },
  connectedCard: {
    borderLeftColor: COLORS.success,
    backgroundColor: '#F7FFF7', // Very light green
  },
  deviceInfo: {
    flex: 1,
    paddingRight: 10,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  deviceAddress: {
    fontSize: 12,
    color: COLORS.subText,
    marginTop: 2,
  },
  statusBadgeContainer: {
    // Container for badge/connect text
  },
  connectedBadge: {
    backgroundColor: COLORS.success,
    color: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    fontSize: 10,
    fontWeight: 'bold',
  },
  connectText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: COLORS.subText,
    fontSize: 16,
  },

  // --- Test Command List Styles (Unchanged) ---
  commandListContainer: {
    flex: 1,
    paddingTop: 15,
  },
  commandCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    padding: 20,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  commandDisabled: {
    opacity: 0.6,
  },
  commandName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  commandArrow: {
    fontSize: 18,
    color: COLORS.subText,
  },

  // --- NEW: Receipt Preview Styles ---
  receiptContainer: {
    // จำกัดความกว้างให้ดูเหมือนกระดาษ thermal
    width: '90%', 
    maxWidth: 384 , // 384px คือความกว้างของ image ที่จะถูก capture (ประมาณ 153dp)
    alignSelf: 'center', // จัดให้อยู่ตรงกลาง
    backgroundColor: '#FFF',
    paddingVertical: 15,
    paddingHorizontal: 5, // padding น้อย ๆ
  },
  receiptHeader: {
    alignItems: 'center', // จัดตรงกลางสำหรับชื่อร้าน
    marginBottom: 10,
  },
  receiptStoreName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 5,
  },
  receiptInfo: {
    fontSize: 14, // ใช้ font เล็กสำหรับข้อมูล
  },
  receiptSeparator: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    marginVertical: 8,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginBottom: 3,
  },
  receiptItemText: {
    fontSize: 16,
    color: COLORS.text,
    flex: 2,
    textAlign: 'left',
  },
  receiptItemPrice: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginBottom: 3,
  },
  receiptSummaryLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  receiptSummaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginTop: 10,
    marginBottom: 15,
  },
  receiptTotalLabel: {
    fontSize: 18,
    fontWeight: '900', // ตัวหนามาก
 
  },
  receiptTotalValue: {
    fontSize: 18,
    fontWeight: '900', // ตัวหนามาก
 
  },
  receiptFooter: {
    alignItems: 'center',
    paddingTop: 10,
  },
  receiptFooterText: {
    fontSize: 14,
    color: COLORS.subText,
  },

  // --- Footer/Disconnect (Unchanged) ---
  footer: {
    backgroundColor: COLORS.card,
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectionStatus: {
    flexShrink: 1,
    marginRight: 10,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.subText,
    fontWeight: '500',
  },
  statusAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginTop: 2,
  },
  disconnectButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    shadowColor: COLORS.secondary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  disconnectButtonDisabled: {
    backgroundColor: COLORS.subText,
    shadowOpacity: 0,
    elevation: 0,
  },
  disconnectButtonText: {
    color: COLORS.card,
    fontSize: 14,
    fontWeight: '600',
  },

  // --- Loading Overlay (Unchanged) ---
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});