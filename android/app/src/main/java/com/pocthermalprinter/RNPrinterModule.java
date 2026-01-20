package com.pocthermalprinter;

import android.Manifest;
import android.graphics.Bitmap;
import android.graphics.Matrix;
import android.graphics.BitmapFactory;


import androidx.annotation.NonNull;
import androidx.annotation.RequiresPermission;

import com.caysn.autoreplyprint.AutoReplyPrint;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;
import com.sun.jna.Pointer;
import com.sun.jna.ptr.IntByReference;


import java.util.HashMap;
import java.util.Map;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.util.Log;
import android.bluetooth.BluetoothSocket;
import java.io.OutputStream;
import java.util.UUID;

public class RNPrinterModule extends ReactContextBaseJavaModule {

    private Pointer handle = Pointer.NULL;
    private BluetoothSocket btSocket = null;
    private OutputStream btOut = null;

    private static final UUID SPP_UUID =
            UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");

    public RNPrinterModule(@NonNull ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "RNPrinterModule";
    }

    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    @ReactMethod
    public void scanBtClassicDevices(Promise promise) {
        new Thread(() -> {
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    promise.reject("BT_NOT_SUPPORTED", "Bluetooth not supported");
                    return;
                }

                WritableArray arr = new WritableNativeArray();

                for (BluetoothDevice d : adapter.getBondedDevices()) {
                    WritableMap map = new WritableNativeMap();
                    map.putString("name", d.getName());
                    map.putString("address", d.getAddress());
                    arr.pushMap(map);
                }

                promise.resolve(arr);
            } catch (Exception e) {
                promise.reject("BT_BONDED_SCAN_ERROR", e.getMessage(), e);
            }
        }).start();
    }


    @RequiresPermission(allOf = {Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT})
    @ReactMethod
    public void connectBtClassicDevice(String macAddress, Promise promise) {
        new Thread(() -> {
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    promise.reject("BT_NOT_SUPPORTED", "Bluetooth not supported");
                    return;
                }

                if (adapter.isDiscovering()) {
                    adapter.cancelDiscovery();
                    try { Thread.sleep(300); } catch (Exception ignored) {}
                }

                // ปิดของเก่าก่อน
                try {
                    if (btOut != null) btOut.close();
                } catch (Exception ignored) {}
                try {
                    if (btSocket != null) btSocket.close();
                } catch (Exception ignored) {}
                btOut = null;
                btSocket = null;

                BluetoothDevice device = adapter.getRemoteDevice(macAddress);

                // ✅ ใช้ SPP UUID มาตรฐาน
                btSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);

                btSocket.connect();
                btOut = btSocket.getOutputStream();

                promise.resolve("SUCCESS_SOCKET");

            } catch (Exception e) {
                promise.reject("BT_CONNECT_ERROR", e.getMessage(), e);
            }
        }).start();
    }

    @ReactMethod
    public void disconnectBtClassicDevice(Promise promise) {
        new Thread(() -> {
            try {
                if (btOut != null) {
                    btOut.close();
                    btOut = null;
                }
                if (btSocket != null) {
                    btSocket.close();
                    btSocket = null;
                }

                promise.resolve("Disconnected");
            } catch (Exception e) {
                promise.reject("BT_DISCONNECT_ERROR", e.getMessage(), e);
            }
        }).start();
    }


    @ReactMethod
    public void testPrintByBtClassic(Promise promise) {
        new Thread(() -> {
            try {
                if (btOut == null) {
                    promise.reject("PRINT_FAILED", "No BT Classic socket connected");
                    return;
                }

                // ESC/POS: initialize printer
                btOut.write(new byte[]{0x1B, 0x40});

                // Print text
                btOut.write("HELLO BT CLASSIC SPP \n".getBytes("UTF-8"));
                btOut.write("581PW3582 TEST PRINT\n\n".getBytes("UTF-8"));

                // Feed + cut (บางรุ่นไม่รองรับ cut)
                btOut.write(new byte[]{0x1D, 0x56, 0x41, 0x10}); // cut partial
                btOut.flush();

                promise.resolve("PRINT_SUCCESS_SOCKET");

            } catch (Exception e) {
                promise.reject("PRINT_ERROR", e.getMessage(), e);
            }
        }).start();
    }




// ---------------------------------------------------------------------------------------------------------------- //



    @ReactMethod
    public void scanBleDevice(Promise promise) {
        new Thread(() -> {
            Map<String, String> devicesMap = new HashMap<>(); // address -> name
            IntByReference cancel = new IntByReference(0);

            AutoReplyPrint.CP_OnBluetoothDeviceDiscovered_Callback callback = new AutoReplyPrint.CP_OnBluetoothDeviceDiscovered_Callback() {
                @Override
                public void CP_OnBluetoothDeviceDiscovered(
                        String device_name,
                        String device_address,
                        Pointer private_data) {
                    if (device_name == null || device_name.equals("null"))
                        return;

                    if (!devicesMap.containsKey(device_address)) {
                        devicesMap.put(device_address, device_name);
                    }
                }
            };

            AutoReplyPrint.INSTANCE.CP_Port_EnumBleDevice(20000, cancel, callback, null);

            WritableArray arr = new WritableNativeArray();
            for (Map.Entry<String, String> entry : devicesMap.entrySet()) {
                WritableMap map = new WritableNativeMap();
                map.putString("name", entry.getValue());
                map.putString("address", entry.getKey());
                arr.pushMap(map);
            }

            promise.resolve(arr);
        }).start();
    }

    @ReactMethod
    public void connectBleDevice(String bleAddress, Promise promise) {
        new Thread(() -> {
            try {
                handle = AutoReplyPrint.INSTANCE.CP_Port_OpenBtBle(bleAddress, 1);

                if (handle != Pointer.NULL) {
                    promise.resolve("SUCCESS");
                } else {
                    promise.reject("BLE_CONNECT_FAILED", "Cannot connect to BLE device");
                }

            } catch (Exception e) {
                promise.reject("BLE_CONNECT_ERROR", e.getMessage(), e);
            }
        }).start();
    }

    @ReactMethod
    public void disconnectBleDevice(Promise promise) {
        new Thread(() -> {
            try {
                if (handle != Pointer.NULL) {
                    AutoReplyPrint.INSTANCE.CP_Port_Close(handle);
                    handle = Pointer.NULL;
                    promise.resolve("Disconnected");
                } else {
                    promise.reject("BLE_DISCONNECT_FAILED", "No device connected");
                }
            } catch (Exception e) {
                promise.reject("BLE_DISCONNECT_ERROR", e.getMessage(), e);
            }
        }).start();
    }

    @ReactMethod
public void testPrintSampleTicket(Promise promise) {
    new Thread(() -> {
        try {
            if (handle == Pointer.NULL) {
                promise.reject("PRINT_FAILED", "No BLE printer connected");
                return;
            }

            int paperWidth = 384;

            // Reset printer
            AutoReplyPrint.INSTANCE.CP_Pos_ResetPrinter(handle);
            AutoReplyPrint.INSTANCE.CP_Pos_SetMultiByteMode(handle);
            AutoReplyPrint.INSTANCE.CP_Pos_SetMultiByteEncoding(handle, AutoReplyPrint.CP_MultiByteEncoding_UTF8);

            // Header
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "123xxstreet,xxxcity,xxxxstate\r\n");
            AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(handle, AutoReplyPrint.CP_Pos_Alignment_Right);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "TEL 9999-99-9999  C#2\r\n");
            AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(handle, AutoReplyPrint.CP_Pos_Alignment_HCenter);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "yyyy-MM-dd HH:mm:ss\r\n");
            AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 1);

            // Items
            String[] items = {"apples", "grapes", "bananas", "lemons", "oranges"};
            String[] prices = {"$10.00", "$20.00", "$30.00", "$40.00", "$100.00"};
            for (int i = 0; i < items.length; i++) {
                AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, items[i]);
                AutoReplyPrint.INSTANCE.CP_Pos_SetHorizontalAbsolutePrintPosition(handle, paperWidth - 12 * (i == 4 ? 7 : 6));
                AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, prices[i]);
                AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 1);
            }

            // Tax and total
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "Before adding tax");
            AutoReplyPrint.INSTANCE.CP_Pos_SetHorizontalAbsolutePrintPosition(handle, paperWidth - 12 * 7);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "$200.00");
            AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 1);

            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "tax 5.0%");
            AutoReplyPrint.INSTANCE.CP_Pos_SetHorizontalAbsolutePrintPosition(handle, paperWidth - 12 * 6);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "$10.00");
            AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 1);

            // Underline
            String line = "";
            for (int i = 0; i < paperWidth / 12; ++i) line += " ";
            AutoReplyPrint.INSTANCE.CP_Pos_SetTextUnderline(handle, 2);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, line);
            AutoReplyPrint.INSTANCE.CP_Pos_SetTextUnderline(handle, 0);
            AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 1);

            // Total
            AutoReplyPrint.INSTANCE.CP_Pos_SetTextScale(handle, 1, 0);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "total");
            AutoReplyPrint.INSTANCE.CP_Pos_SetHorizontalAbsolutePrintPosition(handle, paperWidth - 12 * 2 * 7);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "$190.00");
            AutoReplyPrint.INSTANCE.CP_Pos_SetTextScale(handle, 0, 0);
            AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 1);

            // Customer payment and change
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "Customer's payment");
            AutoReplyPrint.INSTANCE.CP_Pos_SetHorizontalAbsolutePrintPosition(handle, paperWidth - 12 * 7);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "$200.00");
            AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 1);

            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "Change");
            AutoReplyPrint.INSTANCE.CP_Pos_SetHorizontalAbsolutePrintPosition(handle, paperWidth - 12 * 6);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintText(handle, "$10.00");
            AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 1);

            // Barcode
            AutoReplyPrint.INSTANCE.CP_Pos_SetBarcodeHeight(handle, 60);
            AutoReplyPrint.INSTANCE.CP_Pos_SetBarcodeUnitWidth(handle, 3);
            AutoReplyPrint.INSTANCE.CP_Pos_SetBarcodeReadableTextPosition(handle, AutoReplyPrint.CP_Pos_BarcodeTextPrintPosition_BelowBarcode);
            AutoReplyPrint.INSTANCE.CP_Pos_PrintBarcode(handle, AutoReplyPrint.CP_Pos_BarcodeType_UPCA, "12345678901");

            // Beep
            AutoReplyPrint.INSTANCE.CP_Pos_Beep(handle, 1, 500);


            promise.resolve("PRINT_SUCCESS");

        } catch (Exception e) {
            promise.reject("PRINT_ERROR", e.getMessage(), e);
        }
    }).start();
}

    @ReactMethod
    public void printImageFromBase64(String base64Image, Promise promise) {
        new Thread(() -> {
            try {
                if (handle == Pointer.NULL) {
                    promise.reject("PRINT_FAILED", "No BLE printer connected");
                    return;
                }

                // แปลง Base64 เป็น Bitmap
                byte[] decodedBytes = android.util.Base64.decode(base64Image, android.util.Base64.DEFAULT);
                Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

                if (bitmap == null || bitmap.getWidth() == 0 || bitmap.getHeight() == 0) {
                    promise.reject("PRINT_FAILED", "Invalid image data");
                    return;
                }

                // ตั้งค่าเครื่องพิมพ์
                AutoReplyPrint.INSTANCE.CP_Pos_SetPrintSpeed(handle, 50); // ความเร็ว
                AutoReplyPrint.INSTANCE.CP_Pos_SetPrintDensity(handle, 15); // ความเข้ม

                int paperWidth = 384;

                // ดึง resolution ของเครื่องพิมพ์
                IntByReference width_mm = new IntByReference();
                IntByReference height_mm = new IntByReference();
                IntByReference dots_per_mm = new IntByReference();
                if (AutoReplyPrint.INSTANCE.CP_Printer_GetPrinterResolutionInfo(handle, width_mm, height_mm, dots_per_mm)) {
                    paperWidth = width_mm.getValue() * dots_per_mm.getValue();
                }

                // ปรับขนาด bitmap ให้พอดีกับความกว้างเครื่องพิมพ์
                bitmap = scaleImageToWidth(bitmap, paperWidth);

                // พิมพ์ภาพแบบ Raster โดยใช้ compression จาก SDK
                boolean result = AutoReplyPrint.CP_Pos_PrintRasterImageFromData_Helper.PrintRasterImageFromBitmap(
                        handle,
                        bitmap.getWidth(),
                        bitmap.getHeight(),
                        bitmap,
                        AutoReplyPrint.CP_ImageBinarizationMethod_ErrorDiffusion,
                        AutoReplyPrint.CP_ImageCompressionMethod_Level2 // ใช้ตัวแปรจาก SDK
                );

                if (result) {
                    AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 2);
                    promise.resolve("PRINT_SUCCESS");
                    
                } else {
                    promise.reject("PRINT_FAILED", "Failed to write image to printer");
                }

            } catch (Exception e) {
                promise.reject("PRINT_ERROR", e.getMessage(), e);
            }
        }).start();
    }

    public static Bitmap scaleImageToWidth(Bitmap bitmap, int w) {
        int bitmapWidth = bitmap.getWidth();
        int bitmapHeight = bitmap.getHeight();
        float scaleWidth = (float) w / bitmapWidth;
        float scaleHeight = scaleWidth;
        Matrix matrix = new Matrix();
        matrix.postScale(scaleWidth, scaleHeight);
        return Bitmap.createBitmap(bitmap, 0, 0, bitmapWidth, bitmapHeight, matrix, false);
    }


}
