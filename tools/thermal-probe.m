// thermal-probe: one JSON line with the Mac's temperatures, fans and thermal pressure, without root.
// - sensors: every temperature sensor the HID event system publishes (IOHIDEventSystemClient), in °C;
// - fans: each fan's actual, target, minimum and maximum speed from the SMC (F<n>Ac/Tg/Mn/Mx), in rpm;
// - pressure: the thermal pressure level macOS throttles by (com.apple.system.thermalpressurelevel:
//   0 nominal, 1 moderate, 2 heavy, 3 trapping, 4 sleeping);
// - thermal_state: NSProcessInfo.thermalState (0 nominal, 1 fair, 2 serious, 3 critical);
// - smc_family: the hottest SMC temperature key of each two-letter family (Te, Tf, Tg, Tp, ...), and
//   smc_top: the five hottest keys overall. Apple doesn't document which key is which sensor, so these
//   are kept raw for correlating with throttling later. Only readings between 20 and 125 °C count.
// Build: clang -O2 -fobjc-arc -framework Foundation -framework IOKit thermal-probe.m -o thermal-probe
#import <Foundation/Foundation.h>
#import <IOKit/IOKitLib.h>
#include <notify.h>

typedef struct __IOHIDEventSystemClient *IOHIDEventSystemClientRef;
typedef struct __IOHIDServiceClient *IOHIDServiceClientRef;
typedef struct __IOHIDEvent *IOHIDEventRef;
extern IOHIDEventSystemClientRef IOHIDEventSystemClientCreate(CFAllocatorRef allocator);
extern int IOHIDEventSystemClientSetMatching(IOHIDEventSystemClientRef client, CFDictionaryRef matching);
extern CFArrayRef IOHIDEventSystemClientCopyServices(IOHIDEventSystemClientRef client);
extern IOHIDEventRef IOHIDServiceClientCopyEvent(IOHIDServiceClientRef service, int64_t type, int32_t options, int64_t timestamp);
extern CFTypeRef IOHIDServiceClientCopyProperty(IOHIDServiceClientRef service, CFStringRef key);
extern double IOHIDEventGetFloatValue(IOHIDEventRef event, int32_t field);
enum { kTemperatureEvent = 15 };

static NSDictionary<NSString *, NSNumber *> *sensors(void) {
  NSMutableDictionary<NSString *, NSNumber *> *out = [NSMutableDictionary dictionary];
  IOHIDEventSystemClientRef client = IOHIDEventSystemClientCreate(kCFAllocatorDefault);
  if (!client) return out;
  // Vendor usage page 0xff00, usage 5: the temperature sensors.
  IOHIDEventSystemClientSetMatching(client, (__bridge CFDictionaryRef)@{@"PrimaryUsagePage" : @0xff00, @"PrimaryUsage" : @5});
  NSArray *services = CFBridgingRelease(IOHIDEventSystemClientCopyServices(client));
  for (id item in services) {
    IOHIDServiceClientRef service = (__bridge IOHIDServiceClientRef)item;
    NSString *name = CFBridgingRelease(IOHIDServiceClientCopyProperty(service, CFSTR("Product")));
    IOHIDEventRef event = IOHIDServiceClientCopyEvent(service, kTemperatureEvent, 0, 0);
    if (!name || !event) {
      if (event) CFRelease(event);
      continue;
    }
    const double celsius = IOHIDEventGetFloatValue(event, kTemperatureEvent << 16);
    CFRelease(event);
    if (celsius > -40 && celsius < 150) {
      // Some names repeat; keep the hottest reading of each.
      NSNumber *seen = out[name];
      if (!seen || seen.doubleValue < celsius) out[name] = @(round(celsius * 10) / 10);
    }
  }
  CFRelease(client);
  return out;
}

// AppleSMC's user-client protocol (selector 2, one 80-byte struct in and out).
typedef struct {
  uint32_t key;
  struct { uint8_t major, minor, build, reserved; uint16_t release; } version;
  struct { uint16_t version, length; uint32_t cpuPLimit, gpuPLimit, memPLimit; } limit;
  struct { uint32_t dataSize, dataType; uint8_t dataAttributes; } info;
  uint8_t result, status, command;
  uint32_t data32;
  uint8_t bytes[32];
} SMCKeyData;

static uint32_t fourcc(const char *s) { return (uint32_t)s[0] << 24 | (uint32_t)s[1] << 16 | (uint32_t)s[2] << 8 | (uint32_t)s[3]; }

static bool smcRead(io_connect_t connection, const char *key, SMCKeyData *value) {
  SMCKeyData in = {0}, out = {0};
  size_t size = sizeof(out);
  in.key = fourcc(key);
  in.command = 9;  // key info
  if (IOConnectCallStructMethod(connection, 2, &in, sizeof(in), &out, &size) != KERN_SUCCESS || out.result) return false;
  in.info = out.info;
  in.command = 5;  // read bytes
  size = sizeof(*value);
  return IOConnectCallStructMethod(connection, 2, &in, sizeof(in), value, &size) == KERN_SUCCESS && !value->result;
}

// A fan value: "flt " on Apple Silicon, fixed-point "fpe2" on older Macs.
static NSNumber *smcNumber(io_connect_t connection, const char *key) {
  SMCKeyData value = {0};
  SMCKeyData in = {0}, info = {0};
  size_t size = sizeof(info);
  in.key = fourcc(key);
  in.command = 9;
  if (IOConnectCallStructMethod(connection, 2, &in, sizeof(in), &info, &size) != KERN_SUCCESS || info.result) return nil;
  if (!smcRead(connection, key, &value)) return nil;
  if (info.info.dataType == fourcc("flt ") && info.info.dataSize == 4) {
    float f;
    memcpy(&f, value.bytes, 4);
    return @(round(f));
  }
  if (info.info.dataType == fourcc("fpe2") && info.info.dataSize == 2) return @((value.bytes[0] << 6) + (value.bytes[1] >> 2));
  if (info.info.dataSize == 1) return @(value.bytes[0]);
  return nil;
}

static NSArray *fans(void) {
  NSMutableArray *out = [NSMutableArray array];
  io_service_t service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSMC"));
  if (!service) return out;
  io_connect_t connection = 0;
  kern_return_t opened = IOServiceOpen(service, mach_task_self(), 0, &connection);
  IOObjectRelease(service);
  if (opened != KERN_SUCCESS) return out;
  const int count = [smcNumber(connection, "FNum") intValue];
  for (int fan = 0; fan < count && fan < 8; ++fan) {
    NSMutableDictionary *entry = [NSMutableDictionary dictionary];
    const char *fields[][2] = {{"rpm", "Ac"}, {"target", "Tg"}, {"min", "Mn"}, {"max", "Mx"}};
    for (size_t i = 0; i < sizeof(fields) / sizeof(fields[0]); ++i) {
      char key[5];
      snprintf(key, sizeof(key), "F%d%s", fan, fields[i][1]);
      NSNumber *v = smcNumber(connection, key);
      if (v) entry[@(fields[i][0])] = v;
    }
    [out addObject:entry];
  }
  IOServiceClose(connection);
  return out;
}

static NSDictionary *smcTemperatures(void) {
  NSMutableDictionary *family = [NSMutableDictionary dictionary];
  NSMutableArray *all = [NSMutableArray array];
  io_service_t service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSMC"));
  if (!service) return @{};
  io_connect_t connection = 0;
  kern_return_t opened = IOServiceOpen(service, mach_task_self(), 0, &connection);
  IOObjectRelease(service);
  if (opened != KERN_SUCCESS) return @{};
  SMCKeyData count = {0};
  uint32_t keys = 0;
  if (smcRead(connection, "#KEY", &count))
    keys = (uint32_t)count.bytes[0] << 24 | (uint32_t)count.bytes[1] << 16 | (uint32_t)count.bytes[2] << 8 | count.bytes[3];
  for (uint32_t i = 0; i < keys; ++i) {
    SMCKeyData in = {0}, out = {0};
    size_t size = sizeof(out);
    in.command = 8;  // key at index
    in.data32 = i;
    if (IOConnectCallStructMethod(connection, 2, &in, sizeof(in), &out, &size) != KERN_SUCCESS || out.result) continue;
    if ((out.key >> 24) != 'T') continue;
    char key[5] = {(char)(out.key >> 24), (char)(out.key >> 16), (char)(out.key >> 8), (char)out.key, 0};
    SMCKeyData info = {0};
    size = sizeof(info);
    in = (SMCKeyData){0};
    in.key = out.key;
    in.command = 9;
    if (IOConnectCallStructMethod(connection, 2, &in, sizeof(in), &info, &size) != KERN_SUCCESS || info.result) continue;
    if (info.info.dataType != fourcc("flt ") || info.info.dataSize != 4) continue;
    SMCKeyData value = {0};
    in.info = info.info;
    in.command = 5;
    size = sizeof(value);
    if (IOConnectCallStructMethod(connection, 2, &in, sizeof(in), &value, &size) != KERN_SUCCESS || value.result) continue;
    float celsius;
    memcpy(&celsius, value.bytes, 4);
    if (!(celsius >= 20 && celsius <= 125)) continue;
    NSString *name = @(key);
    NSNumber *rounded = @(round(celsius * 10) / 10);
    NSString *prefix = [name substringToIndex:2];
    if (!family[prefix] || [family[prefix] doubleValue] < celsius) family[prefix] = rounded;
    [all addObject:@[ name, rounded ]];
  }
  IOServiceClose(connection);
  [all sortUsingComparator:^NSComparisonResult(NSArray *a, NSArray *b) { return [b[1] compare:a[1]]; }];
  return @{@"family" : family, @"top" : [all subarrayWithRange:NSMakeRange(0, MIN(all.count, (NSUInteger)5))]};
}

int main(void) {
  @autoreleasepool {
    int token = 0;
    uint64_t pressure = 0;
    NSNumber *pressureLevel = nil;
    if (notify_register_check("com.apple.system.thermalpressurelevel", &token) == NOTIFY_STATUS_OK &&
        notify_get_state(token, &pressure) == NOTIFY_STATUS_OK)
      pressureLevel = @(pressure);
    NSDictionary *smc = smcTemperatures();
    NSDictionary *result = @{
      @"pressure" : pressureLevel ?: [NSNull null],
      @"thermal_state" : @(NSProcessInfo.processInfo.thermalState),
      @"fans" : fans(),
      @"sensors" : sensors(),
      @"smc_family" : smc[@"family"] ?: @{},
      @"smc_top" : smc[@"top"] ?: @[],
    };
    NSData *json = [NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingSortedKeys error:nil];
    fwrite(json.bytes, 1, json.length, stdout);
    fputc('\n', stdout);
    return 0;
  }
}
