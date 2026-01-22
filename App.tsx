import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  // NativeModules,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { ensureBluetoothPermissions } from './ensureBluetoothPermissions'

import { BleManager, Device } from 'react-native-ble-plx'
import { Buffer } from 'buffer'
import { convertImageUriToEscPosRasterBytes } from './utils/escposImage'

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

// const { RNPrinterModule } = NativeModules;

interface BleDevice {
  name: string;
  address: string;
}


const TestCommandList: React.FC<{
  connectedAddress: string;
  testPrint: any;
  printPreviewImage: any;
  previewRef: any;
  setLoading: (loading: boolean) => void;
  loading: boolean;
}> = ({ connectedAddress, testPrint, printPreviewImage, previewRef, setLoading, loading }) => {

  const commands = [
    { id: 'test', name: 'Print Sample Ticket', action: testPrint },
    { id: 'image', name: 'Print Preview Image', action: printPreviewImage },
  ];

  const renderCommandItem = ({ item }: { item: any }) => (
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

      <ReceiptPreview />

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
  const [connectedInstantDevice, setConnectedInstantDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);


  const previewRef = useRef<View>(null);

  const manager = new BleManager()
  let devicesMap = new Map<string, Device>()

  type WritableChar = {
    serviceUUID: string
    charUUID: string
    withResponse: boolean
    withoutResponse: boolean
  }

  const [allWritableChars, setAllWritableChars] = useState<WritableChar[]>([])

  const preferred = [
    {
      serviceUUID: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      charUUID: '49535343-8841-43f4-a8d4-ecbe34729bb3',
    },
    {
      serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
      charUUID: '00002af1-0000-1000-8000-00805f9b34fb',
    },
    {
      serviceUUID: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      charUUID: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
    },
  ]



  async function connectBlePrinter(deviceId: string) {
    console.log('🔌 Connecting to BLE printer:', deviceId)
    setAllWritableChars([]) // ✅ reset ทุกครั้งก่อนหาใหม่

    const device = await manager.connectToDevice(deviceId, { timeout: 15000 })
    const discovered = await device.discoverAllServicesAndCharacteristics()

    const services = await discovered.services()
    console.log('✅ Services count:', services.length)

    const tempWritableChars: WritableChar[] = []

    // ... loop services/characteristics
    for (const s of services) {
      const chars = await s.characteristics()

      for (const c of chars) {
        const writable = c.isWritableWithResponse || c.isWritableWithoutResponse
        if (writable) {
          console.log('✅ Writable char found:', {
            serviceUUID: s.uuid,
            charUUID: c.uuid,
            withResponse: c.isWritableWithResponse,
            withoutResponse: c.isWritableWithoutResponse,
          })

          tempWritableChars.push({
            serviceUUID: s.uuid,
            charUUID: c.uuid,
            withResponse: !!c.isWritableWithResponse,
            withoutResponse: !!c.isWritableWithoutResponse,
          })

        }
      }
    }

    setAllWritableChars(tempWritableChars)

    return device
  }

  function bytesToBase64(bytes: number[]) {
    return Buffer.from(Uint8Array.from(bytes)).toString('base64')
  }

  function chunkArray(arr: number[], size: number) {
    const chunks: number[][] = []
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size))
    }
    return chunks
  }


  async function blePrintText(
    device: Device,
    serviceUUID: string,
    charUUID: string,
    text: string
  ) {
    // ✅ ESC/POS: init + text + linefeed
    const escposBytes: number[] = [
      0x1b, 0x40, // ESC @ init
      ...Buffer.from(text, 'ascii'),
      0x0a, 0x0a,
    ]

    const chunks = chunkArray(escposBytes, 20)

    for (const chunk of chunks) {
      const payloadBase64 = bytesToBase64(chunk)

      // ✅ เลือกแบบ withoutResponse เป็นหลัก (printer ส่วนใหญ่ชอบแบบนี้)
      await device.writeCharacteristicWithoutResponseForService(
        serviceUUID,
        charUUID,
        payloadBase64
      )
    }

    // console.log('✅ Print done')
  }

  function pickWriteTarget(allWritableChars: any, preferredList: any) {
    for (const p of preferredList) {
      const found = allWritableChars.find(
        (x: any) =>
          x.serviceUUID.toLowerCase() === p.serviceUUID.toLowerCase() &&
          x.charUUID.toLowerCase() === p.charUUID.toLowerCase()
      )
      if (found) return found
    }
    return allWritableChars[0] // fallback สุดท้าย
  }

  const printPreviewImage = useCallback(async () => {
    if (!previewRef.current) return;
    setLoading(true);
    try {

      setTimeout(async () => {

        // 1) จับภาพ (ไม่ต้องกำหนด width ที่ ViewShot)
        const uri = await captureRef(previewRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: 384,
        });


        // ✅ แปลงเป็น ESC/POS bytes
        const escposBytes = await convertImageUriToEscPosRasterBytes(uri, {
          paperWidthDots: 384,
          threshold: 170,  // ปรับเข้ม/อ่อน
          dither: true,    // ให้สวยขึ้น
        })

         // ❌ ยังไม่พบวิธีสั่งปริ้นภาพผ่าน BLE

        // console.log('✅ Print Image done')
        // Alert.alert('Print Success', 'Image sent to printer.');
      }, 1000);

    } catch (e) {
      console.error('Image print failed', e);
      Alert.alert('Print Failed', 'Could not print image.');
    }
    setLoading(false);
  }, [previewRef, connectedInstantDevice, allWritableChars, preferred]);


  const testPrint = useCallback(async () => {
    setLoading(true);

    try {

      if (!connectedInstantDevice) {
        Alert.alert('Not Connected', 'Please connect to a device first.');
        setLoading(false);
        return;
      }

      // ✅ เรียกตรงนี้!
      const target = pickWriteTarget(allWritableChars, preferred)

      // แล้วค่อยเอา target ไปพิมพ์
      const serviceUUID = target.serviceUUID
      const charUUID = target.charUUID

      const text = ('\n\nHELLO BLE PRINTER HELLO BLE PRINTER HELLO BLE PRINTER HELLO BLE PRINTER HELLO BLE PRINTER\n\n');

      await blePrintText(
        connectedInstantDevice,
        serviceUUID,
        charUUID,
        text);

      const isDeli3582 = connectedInstantDevice.name?.includes('Printer_3582_BLE') || false;
      // Feed extra lines for Deli 3582
      isDeli3582 && await blePrintText(
        connectedInstantDevice,
        serviceUUID,
        charUUID,
        '\n');
      // -----------------------------------//

      console.log('✅ Print Text done')
      Alert.alert('Print Success', 'Test print completed.');
    } catch (e) {
      console.error(e);
      Alert.alert('Print Failed', 'Could not complete test print.');
    }


    setLoading(false);

  }, [connectedInstantDevice, allWritableChars, preferred]);


  useEffect(() => {
    const init = async () => {
      console.log("init app");
      const result = await ensureBluetoothPermissions();
      console.log("Permissions granted:", result);
    };
    init();
  }, []);

  // --- Functions (Unchanged) ---
  const scanDevices = async () => {
    if (isScanning) return;
    setLoading(true);
    setIsScanning(true);
    setDevices([]);

    try {

      devicesMap.clear()

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log("❌ Scan error:", error)
          return
        }

        if (!device) return

        // ✅ filter: เอาเฉพาะที่มีชื่อ (กันรก)
        if (!device.name && !device.localName) return

        // ✅ กันซ้ำด้วย id
        devicesMap.set(device.id, device)

        // ✅ แปลง map → array แล้วส่งออกไปให้ UI render
        const list = Array.from(devicesMap.values())
        setDevices(
          list.map(d => ({
            name: d.name || d.localName || 'N/A',
            address: d.id,
          }))
        )
        // Printer_3582_BLE , P58H40-F7D4

      })

      // ✅ stop scan หลังครบเวลา
      setTimeout(() => {
        manager.stopDeviceScan()
        console.log("🛑 stopDeviceScan()")
      }, 8000)

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

  const connectDevice = useCallback(async (device: BleDevice) => {
    if (connectedInstantDevice?.id === device.address) {
      Alert.alert('Already Connected', `${device.name} is already connected.`);
      return;
    }
    setLoading(true);

    try {
      const connected = await connectBlePrinter(device.address);
      setConnectedInstantDevice(connected);

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
  }, [connectedInstantDevice]);

  const disconnectDevice = useCallback(async () => {
    setLoading(true);

    try {
      await connectedInstantDevice?.cancelConnection();
      setConnectedInstantDevice(null);
      Alert.alert('Disconnected', 'Device successfully disconnected.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not disconnect the device.');
    }

    setLoading(false);
  }, [connectedInstantDevice]);

  // --- Components (Unchanged) ---
  const renderDeviceItem = ({ item }: { item: BleDevice }) => {
    const isConnected = connectedInstantDevice?.id === item.address;
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


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BLE Printer Connect</Text>
      </View>

      {connectedInstantDevice ? (
        <TestCommandList
          connectedAddress={connectedInstantDevice?.id || ''}
          testPrint={testPrint}
          printPreviewImage={printPreviewImage}
          previewRef={previewRef}
          setLoading={setLoading}
          loading={loading}
        />
      ) : (
        <>
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

      {/* Disconnect Footer (แสดงทุกครั้งที่ connectedInstantDevice มีค่า) */}
      {connectedInstantDevice && (
        <View style={styles.footer}>
          <View style={styles.connectionStatus}>
            <Text style={styles.statusLabel}>Connected:</Text>
            <Text style={styles.statusAddress}>{connectedInstantDevice?.id}</Text>
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
    shadowOffset: { width: 0, height: 4 },
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
    shadowOffset: { width: 0, height: 2 },
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
    maxWidth: 384, // 384px คือความกว้างของ image ที่จะถูก capture (ประมาณ 153dp)
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
    fontSize: 18, // ใช้ font เล็กสำหรับข้อมูล
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
    shadowOffset: { width: 0, height: 2 },
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