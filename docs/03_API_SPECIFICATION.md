# API SPECIFICATION (RESTful)

Kiến trúc API tuân thủ tiêu chuẩn RESTful, trả về dữ liệu định dạng JSON chuẩn mực.
Response chuẩn cho Error:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## 1. PUBLIC API (Module Đặt Lịch Cho Bệnh Nhân)

| Phương thức | Endpoint | Chức năng | Authorization |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/public/services` | Lấy danh sách dịch vụ đang mở | Public |
| `GET` | `/api/public/providers` | Lấy danh sách bác sĩ đang mở | Public |
| `GET` | `/api/public/availability` | Tính toán và trả về các slot rảnh (Query: date, service, provider) | Public |
| `POST` | `/api/public/appointments/hold` | Giữ chỗ 5 phút (Tạo session token) | Public |
| `POST` | `/api/public/appointments` | Xác nhận đặt lịch chính thức | Public (Kèm Hold Token) |

## 2. RECEPTION / DOCTOR API (Quản Lý Lịch Hẹn)

| Phương thức | Endpoint | Chức năng | Authorization |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/appointments` | Lấy danh sách lịch hẹn (Lọc theo ngày, trạng thái, bác sĩ) | `receptionist`, `dentist` |
| `POST` | `/api/appointments/:id/confirm` | Chốt lịch thủ công | `receptionist` |
| `POST` | `/api/appointments/:id/check-in` | BN đến phòng khám | `receptionist`, `assistant` |
| `POST` | `/api/appointments/:id/status` | Cập nhật (In_service, Completed, No-show) | `receptionist`, `dentist` |
| `POST` | `/api/appointments/:id/cancel` | Hủy lịch (Ghi nhận lý do) | `receptionist`, `patient` |
| `POST` | `/api/appointments/:id/reschedule`| Đổi lịch (Xóa cũ, tạo mới, liên kết audit) | `receptionist` |

## 3. PATIENT MANAGEMENT API

| Phương thức | Endpoint | Chức năng | Authorization |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/patients` | Tìm kiếm bệnh nhân (Tên, SĐT, Mã) | `receptionist`, `dentist` |
| `GET` | `/api/patients/:id/history` | Xem lịch sử khám của BN | `receptionist`, `dentist` |

## 4. WAITLIST & RECALL API

| Phương thức | Endpoint | Chức năng | Authorization |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/waitlist` | Đăng ký Waitlist | Public / `receptionist` |
| `GET` | `/api/waitlist/matches` | Tìm Waitlist phù hợp với slot trống | `receptionist` |
| `GET` | `/api/recalls` | Danh sách bệnh nhân cần gọi tái khám | `receptionist` |

## 5. NOTIFICATION API

| Phương thức | Endpoint | Chức năng | Authorization |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/notifications/subscribe` | Đăng ký Web Push Subscription | Public (User device) |
| `GET` | `/api/notifications` | Lấy Notification Center trong in-app | Auth User |

## 6. ANALYTICS API

| Phương thức | Endpoint | Chức năng | Authorization |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/dashboard` | Thống kê số lượng, conversion, no-show rate | `manager`, `admin` |
| `GET` | `/api/analytics/utilization` | Hiệu suất bác sĩ, ghế | `manager`, `admin` |
