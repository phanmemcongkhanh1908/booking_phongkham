# DATABASE ERD & SCHEMA SPECIFICATION

Cơ sở dữ liệu sử dụng **PostgreSQL**. Lớp ORM sử dụng **Drizzle ORM** để đảm bảo type-safety với TypeScript.

## 1. SƠ ĐỒ THỰC THỂ QUAN HỆ (ERD)

```mermaid
erDiagram
    USERS ||--o{ ROLES : has
    USERS {
        uuid id PK
        string email
        string password_hash
        uuid role_id FK
        boolean is_active
    }

    ROLES {
        uuid id PK
        string name
        jsonb permissions
    }

    PATIENTS ||--o{ APPOINTMENTS : books
    PATIENTS ||--o{ WAITLIST : joins
    PATIENTS ||--o{ PATIENT_RECALLS : receives
    PATIENTS {
        uuid id PK
        string full_name
        string phone
        date dob
        string gender
        string notes
    }

    PROVIDERS ||--o{ APPOINTMENTS : handles
    PROVIDERS ||--o{ PROVIDER_SERVICES : offers
    PROVIDERS {
        uuid id PK
        string name
        string specialty
        jsonb working_hours
        boolean booking_enabled
    }

    SERVICES ||--o{ PROVIDER_SERVICES : provided_by
    SERVICES ||--o{ APPOINTMENTS : requested
    SERVICES {
        uuid id PK
        string name
        int duration_mins
        int buffer_before
        int buffer_after
        boolean auto_confirm
        int recall_interval_days
    }

    RESOURCES ||--o{ APPOINTMENTS : utilizes
    RESOURCES {
        uuid id PK
        string name
        string type "ROOM | CHAIR | EQUIPMENT"
        boolean is_active
    }

    APPOINTMENTS {
        uuid id PK
        uuid patient_id FK
        uuid provider_id FK
        uuid service_id FK
        uuid chair_id FK
        uuid room_id FK
        timestamp start_at
        timestamp end_at
        string status "PENDING | CONFIRMED | CHECKED_IN | IN_SERVICE | COMPLETED | CANCELLED | NO_SHOW"
        string cancel_reason
    }

    APPOINTMENT_HOLDS {
        uuid id PK
        string session_token
        uuid provider_id
        timestamp start_at
        timestamp end_at
        timestamp expires_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        string action
        string entity
        uuid entity_id
        jsonb before_data
        jsonb after_data
        timestamp created_at
    }
```

## 2. QUY TẮC TOÀN VẸN (CONSTRAINTS & INDEXES)

- **Double Booking Prevention:**
  Sử dụng Transaction Isolation Level `SERIALIZABLE` khi Insert vào bảng `APPOINTMENTS`. Đồng thời có thể tạo Constraint loại trừ (Exclusion Constraint) trên PostgreSQL cho các trường hợp gối chồng thời gian của cùng một `provider_id` hoặc `chair_id` (Nâng cao).
  
- **Indexes:**
  - `idx_patients_phone`: Tìm kiếm nhanh bệnh nhân khi book lịch.
  - `idx_appointments_start_end`: Tìm lịch rảnh (Availability query).
  - `idx_appointments_provider`: Lọc lịch theo bác sĩ.
  - `idx_audit_logs_created`: Lọc lịch sử theo thời gian.

- **Soft Delete:**
  Các dữ liệu Master (Provider, Service, Resource) không được DELETE vật lý mà sử dụng cột `is_active = false` để tránh đứt gãy lịch sử Audit và Appointment cũ.
