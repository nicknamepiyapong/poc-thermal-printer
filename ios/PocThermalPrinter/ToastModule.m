//
//  ToastModule.m
//  PocThermalPrinter
//
//  Created by LOS on 29/9/2568 BE.
//

#import <Foundation/Foundation.h>
#import "ToastModule.h"
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>

@implementation ToastModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(show:(NSString *)message) {
  dispatch_async(dispatch_get_main_queue(), ^{

    UIViewController *rootVC = RCTPresentedViewController();
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:nil
                                                                   message:message
                                                            preferredStyle:UIAlertControllerStyleAlert];
    [rootVC presentViewController:alert animated:YES completion:nil];
    
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [alert dismissViewControllerAnimated:YES completion:nil];
    });
  });
}

@end
