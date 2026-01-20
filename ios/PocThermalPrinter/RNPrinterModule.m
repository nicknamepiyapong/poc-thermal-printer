//
//  RNPrinterModule.m
//  PocThermalPrinter
//

#import <Foundation/Foundation.h>
#import "RNPrinterModule.h"
#import <autoreplyprint/autoreplyprint.h>


static NSMutableArray *gFoundDevices = nil;
static void *gBleHandle = NULL;


static void bleDeviceCallback(const char *device_name, const char *device_address, const void *private_data)
{
    if (!gFoundDevices) return;
    
    NSDictionary *device = @{
        @"name": device_name ? [NSString stringWithUTF8String:device_name] : @"",
        @"address": device_address ? [NSString stringWithUTF8String:device_address] : @""
    };
    
   @synchronized(gFoundDevices) {
    BOOL exists = NO;
    for (NSDictionary *d in gFoundDevices) {
        if ([d[@"address"] isEqualToString:device[@"address"]]) {
            exists = YES;
            break;
        }
    }
    if (!exists) {
        [gFoundDevices addObject:device];
    }
}

}

@implementation RNPrinterModule

RCT_EXPORT_MODULE();


RCT_REMAP_METHOD(scanBleDevice,
                 scanBleDeviceWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        gFoundDevices = [NSMutableArray array];
        int cancel = 0;

       
        CP_Port_EnumBleDevice(12000, &cancel, bleDeviceCallback, NULL);

       
        dispatch_async(dispatch_get_main_queue(), ^{
            resolve(gFoundDevices);
            gFoundDevices = nil;
        });
    });
}

RCT_REMAP_METHOD(connectBleDevice,
                 connectBleDeviceWithAddress:(NSString *)bleAddress
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!bleAddress || bleAddress.length == 0) {
        reject(@"INVALID_ADDRESS", @"BLE address is empty", nil);
        return;
    }

    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        const char *cAddress = [bleAddress UTF8String];

        // เปิดการเชื่อมต่อ BLE
        void *handle = CP_Port_OpenBtBle(cAddress, 1); // 1 = auto connect

        if (handle) {
            gBleHandle = handle;
            dispatch_async(dispatch_get_main_queue(), ^{
                resolve(@{@"success": @YES});
            });
        } else {
            dispatch_async(dispatch_get_main_queue(), ^{
                reject(@"CONNECT_FAILED", @"Failed to connect to BLE device", nil);
            });
        }
    });
}

// ฟังก์ชัน disconnect BLE device
RCT_REMAP_METHOD(disconnectBleDevice,
                 disconnectBleDeviceWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        if (gBleHandle) {
            CP_Port_Close(gBleHandle);
            gBleHandle = NULL;
            dispatch_async(dispatch_get_main_queue(), ^{
                resolve(@{@"success": @YES});
            });
        } else {
            dispatch_async(dispatch_get_main_queue(), ^{
                reject(@"NOT_CONNECTED", @"No BLE device is connected", nil);
            });
        }
    });
}

RCT_REMAP_METHOD(testPrintSampleTicket,
                 testPrintSampleTicketWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        if (!gBleHandle) {
            dispatch_async(dispatch_get_main_queue(), ^{
                reject(@"NO_CONNECTED_DEVICE", @"No BLE device connected", nil);
            });
            return;
        }

        void *h = gBleHandle;
        int paperWidth = 384;

        CP_Pos_ResetPrinter(h);
        CP_Pos_SetMultiByteMode(h);
        CP_Pos_SetMultiByteEncoding(h, CP_MultiByteEncoding_UTF8);

        CP_Pos_PrintText(h, "123xxstreet,xxxcity,xxxxstate\r\n");
        CP_Pos_SetAlignment(h, CP_Pos_Alignment_Right);
        CP_Pos_PrintText(h, "TEL 9999-99-9999  C#2\r\n");
        CP_Pos_SetAlignment(h, CP_Pos_Alignment_HCenter);
        CP_Pos_PrintText(h, "2018-06-19 14:09:00");
        CP_Pos_FeedLine(h, 1);
        CP_Pos_PrintText(h, "นี่คือ text ของ วัจน์กร จันทรา");
        CP_Pos_FeedLine(h, 1);

        // ตัวอย่างรายการสินค้า
        NSArray *items = @[
            @{@"name": @"apples", @"price": @"$10.00"},
            @{@"name": @"grapes", @"price": @"$20.00"},
            @{@"name": @"bananas", @"price": @"$30.00"},
            @{@"name": @"lemons", @"price": @"$40.00"},
            @{@"name": @"oranges", @"price": @"$100.00"}
        ];

        for (NSDictionary *item in items) {
            CP_Pos_PrintText(h, [item[@"name"] UTF8String]);
            CP_Pos_SetHorizontalAbsolutePrintPosition(h, paperWidth - 12 * [item[@"price"] length]);
            CP_Pos_PrintText(h, [item[@"price"] UTF8String]);
            CP_Pos_FeedLine(h, 1);
        }
        
        CP_Pos_FeedLine(h, 2);
        CP_Pos_Beep(h, 1, 500);
        


        dispatch_async(dispatch_get_main_queue(), ^{
            resolve(@(YES));
        });
    });
}

RCT_REMAP_METHOD(printImageFromBase64,
                 printImageFromBase64:(NSString *)base64
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSData *imageData = [[NSData alloc] initWithBase64EncodedString:base64 options:0];
        if (!imageData) {
            reject(@"INVALID_IMAGE", @"Failed to decode base64 image", nil);
            return;
        }

        UIImage *image = [UIImage imageWithData:imageData];
        if (!image) {
            reject(@"INVALID_IMAGE", @"Failed to create UIImage", nil);
            return;
        }

        if (!gBleHandle) {
            reject(@"NOT_CONNECTED", @"No BLE printer connected", nil);
            return;
        }
       CP_Pos_SetPrintSpeed(gBleHandle, 100);
        int pageWidth = 384;
        int dstW = image.size.width;
        int dstH = image.size.height;
        if (dstW > pageWidth) {
            dstW = pageWidth;
            dstH = (int)(dstW * (image.size.height / image.size.width));
        }

        CP_Pos_PrintRasterImageFromData(gBleHandle, dstW, dstH, (unsigned char *)imageData.bytes, (unsigned int)imageData.length, CP_ImageBinarizationMethod_Thresholding, CP_ImageCompressionMethod_None);
        CP_Pos_FeedLine(gBleHandle, 3);

        dispatch_async(dispatch_get_main_queue(), ^{
            resolve(@(YES));
        });
    });
}


@end
