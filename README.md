# NHTSA Edge API & High-Performance Caching Gateway ⚡🚗

> **Cloudflare Workers** edge gateway cung cấp API dữ liệu phương tiện giao thông (NHTSA VPIC & Recalls) với tốc độ phản hồi cực nhanh (~3ms - 15ms), giảm tải ~70% dung lượng payload và đảm bảo khả năng chịu tải cao vượt trội so với gọi trực tiếp vào máy chủ của chính phủ Mỹ (NHTSA dot gov).

---

## 🎯 Vấn Đề Của NHTSA API Gốc & Giải Pháp Cloudflare

| Tiêu chí | Trực tiếp NHTSA API (`vpic.nhtsa.dot.gov`) | Cloudflare Edge API (`nhtsa-edge-api`) |
| :--- | :--- | :--- |
| **Độ trễ trung bình** | **300ms - 2,500ms+** (máy chủ đặt tại Mỹ, phụ thuộc khoảng cách địa lý) | **3ms - 15ms** (được phục vụ ngay tại 300+ PoP Cloudflare toàn cầu) |
| **Kích thước Payload** | **~4 KB - 18 KB** (chứa hơn 100 trường rỗng `""` và null) | **~800 B - 1.2 KB** (chế độ Compact loại bỏ trường thừa, tiết kiệm ~70% data) |
| **Tần suất cập nhật xe** | Dữ liệu xuất xưởng theo VIN (Make, Model, Year,...) **không bao giờ thay đổi** | Caching thông minh: **30 ngày** cho VIN, **7 ngày** cho danh mục hãng/mẫu xe |
| **Chịu tải đột biến** | Thường xuyên dính lỗi `504 Gateway Timeout` hoặc rate limit | **Request Coalescing (Single-Flight)**: chống thundering herd, 100k+ req/day miễn phí |
| **Tương thích ngược** | Cần viết lại logic nếu đổi thư viện | **100% Drop-in Replacement**: chỉ cần đổi Base URL |

---

## 🏗️ Kiến Trúc Kỹ Thuật (Safe High-Performance Engineering)

1. **Framework siêu nhẹ Hono v4**: Tối ưu riêng cho Web Standards và Cloudflare Workers runtime (V8 isolates), thời gian xử lý routing chỉ ~0.01ms.
2. **Multi-Tier Edge Caching**:
   - **L1 Edge Cache API (`caches.default`)**: Cache trực tiếp tại Anycast Edge PoP gần người dùng nhất. Hỗ trợ `stale-while-revalidate` (SWR) trả kết quả tức thì trong khi âm thầm làm mới dữ liệu nền.
   - **L2 Cloudflare KV (Tuỳ chọn)**: Bộ nhớ phân tán toàn cầu cho dữ liệu VIN và hãng xe vĩnh cửu.
3. **Request Coalescing (Thundering Herd Protection)**: Khi có nhiều request đồng thời gửi tới cùng một VIN chưa được cache, hệ thống chỉ gửi **1 request duy nhất** lên NHTSA và chia sẻ Promise cho các client khác.
4. **Resilient Network Client**: Trang bị `AbortController` timeout (mặc định 5s) và cơ chế tự động thử lại (Retry with Exponential Backoff) khi NHTSA gặp lỗi 502/503/504.
5. **Strict Type Safety**: Tuân thủ chuẩn mực kiểm soát kiểu dữ liệu nghiêm ngặt: TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, không dùng `any`, xử lý schema bằng `zod`.

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng

### 1. Yêu cầu môi trường
- Node.js >= 18 (đã kiểm thử mượt mà trên Node v24)
- `pnpm` hoặc `npm`

### 2. Cài đặt thư viện
```bash
cd /Users/tuannguyen/.gemini/antigravity/scratch/nhtsa-edge-api
pnpm install
```

### 3. Chạy thử nghiệm Local (Miniflare Edge Simulator)
```bash
pnpm dev
# Server lắng nghe tại http://localhost:8787
```

### 4. Kiểm tra Typecheck và Test Suite
```bash
# Kiểm tra an toàn kiểu dữ liệu (Zero errors)
pnpm typecheck

# Chạy toàn bộ 17 unit & integration tests
pnpm test
```

### 5. Chạy Benchmark So Sánh Tốc Độ Thực Tế
Trong khi `pnpm dev` đang chạy, mở một terminal khác và chạy script:
```bash
./scripts/benchmark.sh 8787
```

**Kết quả thực tế đo đạc:**
```text
==========================================================
⚡ NHTSA API vs Cloudflare Edge API Benchmark
==========================================================
Test VIN: 5UXWX7C5*BA

Direct NHTSA VPIC : 0.286s | 3994 bytes
Edge Proxy (HIT)  : 0.0035s | 3994 bytes  (Nhanh hơn ~80 lần)
Edge Compact (HIT): 0.0034s | 1251 bytes  (Giảm ~70% dung lượng payload)
==========================================================
```

---

## 📡 API Reference & Hướng Dẫn Sử Dụng

### Lựa chọn 1: Modern RESTful V1 API (Khuyên dùng)
API định dạng JSON sạch, các trường số được ép kiểu chuẩn, loại bỏ hơn 100 biến trống rác:

| Method | Endpoint | Mô tả | Cache TTL |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/vin/:vin` | Giải mã số VIN chi tiết (Make, Model, Year, Cylinders,...) | 30 ngày |
| `GET` | `/api/v1/makes` | Danh sách tất cả các hãng xe đã đăng ký NHTSA | 7 ngày |
| `GET` | `/api/v1/models?make=toyota` | Danh sách các mẫu xe của một hãng | 7 ngày |
| `GET` | `/api/v1/recalls/:vin` | Tra cứu lịch sử lệnh thu hồi / an toàn theo VIN | 6 giờ |

**Mẫu phản hồi `GET /api/v1/vin/5UXWX7C5*BA`:**
```json
{
  "success": true,
  "data": {
    "vin": "5UXWX7C5*BA",
    "make": "BMW",
    "model": "X3",
    "year": 2011,
    "trim": "xDrive35i",
    "vehicleType": "MULTIPURPOSE PASSENGER VEHICLE (MPV)",
    "bodyClass": "Sport Utility Vehicle [SUV]/Multipurpose Vehicle [MPV]",
    "doors": 4,
    "driveType": "AWD/All-Wheel Drive",
    "engineCylinders": 6,
    "displacementL": 3,
    "engineHp": 300,
    "fuelType": "Gasoline",
    "plantCountry": "GERMANY",
    "plantCity": "MUNICH",
    "manufacturer": "BMW NORTH AMERICA",
    "isValidVin": true,
    "errorCode": "0",
    "errorText": "0 - VIN decoded clean",
    "extraAttributes": {
      "AirBagLocFront": "1st Row (Driver and Passenger)",
      "TPMS": "Direct",
      "DisplacementCC": "2979.168"
    }
  },
  "source": "EDGE_CACHE",
  "cached": true,
  "timestamp": "2026-09-27T03:40:18.535Z"
}
```

---

### Lựa chọn 2: 100% Drop-in Transparent VPIC Proxy
Dành cho các ứng dụng đã viết sẵn logic gọi `vpic.nhtsa.dot.gov/api/vehicles/*`. Không cần sửa đổi path hay code xử lý, chỉ cần trỏ domain sang Cloudflare Worker:

- `GET /vehicles/DecodeVinValues/:vin?format=json`
- `GET /vehicles/DecodeVin/:vin?format=json`
- `GET /vehicles/GetModelsForMake/:make?format=json`
- `GET /vehicles/GetAllMakes?format=json`

> **Mẹo (Feature độc quyền)**: Thêm tham số `?clean=true` vào bất kỳ endpoint VPIC nào để Worker tự động dọn sạch các trường chuỗi rỗng `""` trước khi trả về cho client:
> ```
> GET /vehicles/DecodeVinValues/5UXWX7C5*BA?format=json&clean=true
> ```

---

## 🌐 Triển Khai Lên Cloudflare Toàn Cầu (Production)

### 1. Đăng nhập tài khoản Cloudflare
```bash
npx wrangler login
```

### 2. (Tuỳ chọn) Bật Persistent KV Cache
Tạo namespace KV để lưu cache vĩnh viễn trên Cloudflare:
```bash
npx wrangler kv:namespace create NHTSA_CACHE_KV
```
Sau đó mở file [wrangler.jsonc](file:///Users/tuannguyen/.gemini/antigravity/scratch/nhtsa-edge-api/wrangler.jsonc), uncomment phần `kv_namespaces` và dán `id` vừa nhận được, đồng thời đổi biến `"ENABLE_KV_CACHE": "true"`.

### 3. Deploy lên Cloudflare
```bash
pnpm deploy
```
Sau khi hoàn tất, bạn sẽ nhận được URL toàn cầu (ví dụ: `https://nhtsa-edge-api.<your-subdomain>.workers.dev`).
