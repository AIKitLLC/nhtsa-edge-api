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
2. **Multi-Tier Edge Caching & Model 2 Local Engine**:
   - **Local NHTSA Master Datasets (Trực tiếp trong Git)**: Nhúng sẵn toàn bộ **13,001 WMI toàn cầu** (`data/wmi-master.json`) và **32,009 mẫu xe** (`data/makes-models.json`) được trích xuất trực tiếp từ bản dump chính thức `vPICList_lite_2026_09`.
   - **Sub-millisecond Local Decoder**: Giải mã VIN trong **0.01ms - 0.05ms** bằng thuật toán chuẩn 49 CFR Part 565 mà không cần gọi ra ngoài Internet.
   - **L1 Edge Cache API (`caches.default`)**: Cache Anycast Edge PoP với `stale-while-revalidate`.
   - **Cloudflare D1 (SQLite Edge Database)**: Cơ sở dữ liệu SQLite phân tán hỗ trợ seed tự động (`migrations/0002_seed_official_wmi.sql`) và cơ chế tự chữa lành (Self-Healing).
3. **Request Coalescing (Thundering Herd Protection)**: Khi có nhiều request đồng thời gửi tới cùng một VIN chưa được cache, hệ thống chỉ gửi **1 request duy nhất** lên NHTSA và chia sẻ Promise cho các client khác.
4. **Resilient Network Client**: Trang bị `AbortController` timeout (mặc định 5s) và cơ chế tự động thử lại (Retry with Exponential Backoff) khi NHTSA gặp lỗi 502/503/504.
5. **Strict Type Safety**: Tuân thủ chuẩn mực kiểm soát kiểu dữ liệu nghiêm ngặt: TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, không dùng `any`, xử lý schema bằng `zod`.
6. **Shadow Parity Verification (`/api/v1/vin/:vin/compare`)**: Chạy song song Local Engine vs Upstream API của NHTSA để kiểm chứng độ chính xác 100%.

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

### Cách 1: Tự động 1-Click bằng Script (Khuyên dùng)
Hệ thống cung cấp sẵn script tự động kiểm tra đăng nhập, tạo D1 Database, migrate schema và deploy toàn bộ lên mạng lưới Cloudflare:

```bash
pnpm run setup:cloudflare
# Hoặc chạy trực tiếp qua Bash:
bash scripts/setup-cloudflare.sh
```

**Script sẽ tự động thực hiện:**
1. Kiểm tra session đăng nhập Cloudflare (`wrangler whoami`).
2. Khởi tạo cơ sở dữ liệu phân tán **Cloudflare D1 (`nhtsa-db`)**.
3. Cập nhật `database_id` chính thức vào `wrangler.jsonc`.
4. Migrate bảng dữ liệu `wmi_catalog`, `makes_models`, `sync_history`.
5. Đẩy code lên 330+ Edge PoP và in ra URL endpoint sẵn sàng sử dụng.

---

### Cách 2: Triển khai thủ công từng bước

1. **Đăng nhập Cloudflare:**
   ```bash
   npx wrangler login
   ```

2. **Tạo D1 SQLite Database trên Cloudflare:**
   ```bash
   npx wrangler d1 create nhtsa-db
   ```
   *Sao chép `database_id` vừa tạo và cập nhật vào `wrangler.jsonc`.*

3. **Áp dụng Migration lên Production:**
   ```bash
   npx wrangler d1 migrations apply nhtsa-db --remote
   ```

4. **(Tuỳ chọn) Bật Persistent KV Cache:**
   ```bash
   npx wrangler kv:namespace create NHTSA_CACHE_KV
   ```
   *Uncomment phần `kv_namespaces` trong `wrangler.jsonc` và đặt `"ENABLE_KV_CACHE": "true"`.*

5. **Deploy lên Cloudflare:**
   ```bash
   pnpm deploy
   ```

---

## 🔄 Tự Động Cập Nhật Dữ Liệu Bằng GitHub Actions

Dự án đã được trang bị sẵn GitHub Actions Workflow [`.github/workflows/nhtsa-sql-sync.yml`](.github/workflows/nhtsa-sql-sync.yml) thực hiện quy trình **DataOps tự động**:

* **Lịch trình**: Tự động chạy lúc **03:00 UTC mỗi đêm Chủ Nhật và đêm Thứ Hai hàng tuần** (`cron: '0 3 * * 0,1'`).
* **Hỗ trợ chạy thủ công**: Nút `Run workflow` trong tab **Actions** trên GitHub.

### Quy trình tự động diễn ra:
1. Quét trang phát hành chính thức của NHTSA (`https://vpic.nhtsa.dot.gov/downloads/`) để tìm kiếm bản dump mới (`vPICList_lite_YYYY_MM`).
2. Tự động tải, convert và cập nhật bộ dữ liệu chuẩn trong Git (`data/wmi-master.json`, `data/makes-models.json`).
3. Nếu chưa có bản dump tháng mới, tự động chạy **Live API incremental sync** để bổ sung các hãng/mẫu xe mới đăng ký trong tuần.
4. Chạy kiểm thử an toàn (`bun test`).
5. Nếu có dữ liệu mới: Tự động `git commit` & `push` vào repo, sau đó deploy Worker bản mới nhất lên Cloudflare!

> **Thiết lập bí mật (Secret)**: Thêm Secret `CLOUDFLARE_API_TOKEN` trong **Repository Settings -> Secrets and variables -> Actions** để GitHub Action tự động deploy lên Cloudflare sau mỗi lần cập nhật dữ liệu.

---

## ⚖️ Tuyên Bố Pháp Lý & Bản Quyền (Legal Attribution & Disclaimer)

* **Phạm vi công cộng (Public Domain)**: Cơ sở dữ liệu VPIC và thông số kỹ thuật VIN tuân theo **17 U.S.C. § 105** (Các tác phẩm của Chính phủ Liên bang Hoa Kỳ tự động thuộc phạm vi công cộng, không có bản quyền).
* **Tuân thủ DPPA & Quyền riêng tư**: Dữ liệu chỉ bao gồm thông số kỹ thuật xe của nhà sản xuất, **hoàn toàn không chứa thông tin cá nhân (PII)** của chủ xe, tuân thủ nghiêm ngặt *Driver's Privacy Protection Act (18 U.S.C. § 2721)*.
* **Ghi nhận nguồn**: Dữ liệu thông số phương tiện được cung cấp bởi **Cục Quản lý An toàn Giao thông Đường cao tốc Quốc gia Mỹ (NHTSA)** thuộc Bộ Giao thông Vận tải Hoa Kỳ (U.S. DOT). Dự án này là cổng gateway độc lập, không phải là cơ quan trực thuộc hay được bảo trợ chính thức bởi chính phủ Mỹ.
