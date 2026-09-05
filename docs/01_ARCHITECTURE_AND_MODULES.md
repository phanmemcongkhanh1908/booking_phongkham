# SYSTEM ARCHITECTURE & MODULES

## 1. THÔNG BÁO VỀ KIẾN TRÚC & MÔI TRƯỜNG (ADAPTATION)

Dựa trên ràng buộc của môi trường triển khai hiện tại (AI Studio / Cloud Run Container), hệ thống yêu cầu sử dụng **TypeScript, Node.js (Express), và Vite** thay vì Python/FastAPI. 

Sự thay đổi này **KHÔNG** làm ảnh hưởng đến các nguyên tắc cốt lõi:
- **Vẫn đảm bảo Zero Cost & Open Source**.
- **Vẫn là Modular Monolith**: Dễ bảo trì, dễ scale.
- **Hiệu năng cao**: Node.js xử lý non-blocking I/O rất tốt cho các API đặt lịch và xử lý đồng thời.
- **Kiểu dữ liệu chặt chẽ**: Sử dụng TypeScript + Zod + Drizzle ORM mang lại trải nghiệm Type-safe (từ Database lên tận Frontend) tương đương, thậm chí tốt hơn Pydantic + SQLAlchemy.

## 2. SYSTEM ARCHITECTURE

```text
[ Trình duyệt / Mobile (PWA) ]
          |
    (HTTPS / REST / Web Push)
          |
[ Reverse Proxy / Web Server ] (Tích hợp trong Node.js/Caddy)
          |
+---------------------------------------------------+
| Node.js Express Application (Modular Monolith)    |
|                                                   |
|  [ API Gateway / Routers ]                        |
|                                                   |
|  [ Controllers / Request Validation (Zod) ]       |
|                                                   |
|  [ Core Engines ]                                 |
|   - Scheduling Engine                             |
|   - Confirmation Engine                           |
|   - Waitlist Engine                               |
|   - Recall Engine                                 |
|                                                   |
|  [ Repositories / Data Access (Drizzle ORM) ]     |
+---------------------------------------------------+
          |
   (TCP / Connection Pool)
          |
[ PostgreSQL Database ]
```

## 3. PROJECT FOLDER STRUCTURE

Cấu trúc dự án sẽ được bố trí như sau để hỗ trợ Fullstack TypeScript:

```text
/
├── docs/                   # Tài liệu kiến trúc, specs
├── server/                 # Backend Node.js
│   ├── api/                # Các route/controller (M01-M18)
│   ├── core/               # Scheduling Engine, Utils, Security
│   ├── db/                 # Drizzle Schema, Migrations, Connection
│   ├── services/           # Business logic (Waitlist, Recall, Push)
│   └── jobs/               # Cronjobs (Node-cron)
├── src/                    # Frontend React + Vite
│   ├── components/         # Reusable UI (Tailwind)
│   ├── pages/              # Các màn hình (Booking, Dashboard...)
│   ├── store/              # State management (Zustand)
│   ├── types/              # Type chia sẻ (Frontend)
│   └── pwa/                # Service worker, manifest
├── shared/                 # Types/Zod Schemas dùng chung cả Front & Back
├── server.ts               # Entry point cho Backend Express
├── vite.config.ts          # Cấu hình Vite & PWA
└── docker-compose.yml      # Tích hợp PostgreSQL local deployment
```

## 4. DANH SÁCH MODULES (M01 - M18)

Được ánh xạ thành các service/controller trong Node.js:
- **M01 - Public Booking**: `server/api/public/`
- **M02 - Appointment**: `server/api/appointments/`
- **M03 - Calendar**: `server/api/calendar/`
- **M04 - Patient**: `server/api/patients/`
- **M05 -> M07 - Master Data**: `server/api/resources/` (Provider, Service, Room, Chair)
- **M08 - Confirmation**: Xử lý trong `AppointmentService`.
- **M09 - Waitlist**: `server/api/waitlist/` & `server/jobs/waitlistMatcher.ts`
- **M10 - Recall**: `server/jobs/recallGenerator.ts`
- **M11 - Notification**: `server/services/notification.ts` (Web Push)
- **M12 - Smart Scheduling**: `server/core/scheduling.ts`
- **M13 - Analytics**: `server/api/analytics/`
- **M14 - User & Auth**: `server/api/auth/` (JWT, RBAC)
- **M16 - Audit Log**: `server/core/audit.ts` (Middleware ghi log)
- **M17 - System Settings**: `server/api/settings/`
- **M18 - Backup**: `scripts/backup.sh` (Cron script)
