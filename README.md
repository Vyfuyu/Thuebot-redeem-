# 🔐 Bot License System - Hệ Thống Redeem Key Thuê Bot

**Tác giả:** Kaori Waguri  
**Phiên bản:** 1.0.0  
**Tương thích:** Tất cả Facebook Messenger Bot (NodeJS)

## 📋 Mô Tả

Hệ thống license key hoàn chỉnh cho bot Messenger, cho phép admin quản lý việc thuê và mượn bot với các tính năng:

- ✅ Key cá nhân (personal) và key nhóm (group)
- ✅ Tự động khóa/mở khóa tất cả tính năng bot
- ✅ Thông báo admin khi có người dùng chưa có key
- ✅ Countdown tự động và cập nhật tên bot hàng ngày
- ✅ Hệ thống chống gian lận key
- ✅ Quản lý expiration date linh hoạt
- ✅ Tự động reset và làm sạch hệ thống

## 🚀 Cài Đặt

### Bước 1: Cài Đặt Dependencies

```bash
npm install sequelize sqlite3 node-cron moment-timezone
```

### Bước 2: Tạo Database Model

Tạo file `icls/db/models/license_keys.js`:

```javascript
module.exports = function(sequelize, DataTypes) {
    const { STRING, INTEGER, TEXT, DATE, BOOLEAN } = DataTypes;
    return sequelize.define('LicenseKeys', {
        keyId: {
            type: STRING,
            primaryKey: true
        },
        keyType: {
            type: STRING, // 'personal' or 'group'
            allowNull: false
        },
        targetId: {
            type: STRING, // userID for personal, threadID for group
            allowNull: false
        },
        targetName: {
            type: TEXT, // user name or group name
            allowNull: true
        },
        expirationDays: {
            type: INTEGER,
            allowNull: false
        },
        remainingDays: {
            type: INTEGER,
            allowNull: false
        },
        isActive: {
            type: BOOLEAN,
            defaultValue: false
        },
        activatedAt: {
            type: DATE,
            allowNull: true
        },
        createdBy: {
            type: STRING, // admin userID who created the key
            allowNull: false
        },
        data: {
            type: TEXT,
            defaultValue: '{}' // Additional data in JSON format
        }
    });
};
```

### Bước 3: Cập Nhật Model Registry

Trong file `icls/db/model.js`, thêm:

```javascript
const LicenseKeys = require("./models/license_keys")(sequelize, Sequelize);

// Thêm vào sync
LicenseKeys.sync({ force });

// Thêm vào return object
return {
    model: {
        Users,
        Threads,
        Currencies,
        LicenseKeys  // <- Thêm dòng này
    },
    // ... rest of code
};
```

### Bước 4: Tạo Admin Commands

Tạo file `modules/commands/redkey.js` (copy từ source code)

### Bước 5: Tạo User Commands

Tạo file `modules/commands/checkkey.js` (copy từ source code)

### Bước 6: Tích Hợp Validation System

Trong file `icls/hdl/handleCommand.js`, thêm validation logic sau permission check:

```javascript
// ========== LICENSE SYSTEM VALIDATION ==========
// Check if license system is enabled
if (global.licenseSystem && global.licenseSystem.enabled) {
    // Commands that bypass license check
    const exemptCommands = ['redkey', 'checkkey', 'admin', 'help'];
    const isAdminUser = ADMINBOT.includes(senderID.toString()) || NDH.includes(senderID.toString());
    
    if (!exemptCommands.includes(command.config.name) && !isAdminUser) {
        // ... (copy full validation logic from source)
    }
}
// ========== END LICENSE SYSTEM VALIDATION ==========
```

### Bước 7: Cài Đặt Daily Countdown System

1. Tạo file `modules/events/licenseCountdown.js` (copy từ source code)
2. Cập nhật `icls/hdl/handleSchedule.js` để thêm cron job daily

### Bước 8: Cấu Hình Scheduler

Đảm bảo scheduler nhận đủ parameters trong `icls/listen.js`:

```javascript
require('./hdl/handleSchedule.js')({
    api,
    Threads,
    Users,
    models  // <- Đảm bảo có models parameter
});
```

## 📖 Hướng Dẫn Sử Dụng

### Admin Commands

#### Tạo Key Mới
```
!redkey [số ngày] [personal/group] [targetID] [tên]
```

**Ví dụ:**
- `!redkey 30 personal 123456789 Nguyen Van A` - Key cá nhân 30 ngày
- `!redkey 7 group 987654321 Nhóm ABC` - Key nhóm 7 ngày

#### Quản Lý Keys
```
!redkey list                    # Xem tất cả keys
!redkey cancel [keyID]          # Hủy key
!redkey reset                   # Reset toàn bộ hệ thống
```

### User Commands

#### Kích Hoạt Key
```
!checkkey [keyID]
```

**Ví dụ:** `!checkkey ABC123DEF456789`

## 🔧 Tùy Chỉnh

### Thay Đổi Commands Được Exempt

Trong `icls/hdl/handleCommand.js`, chỉnh sửa:

```javascript
const exemptCommands = ['redkey', 'checkkey', 'admin', 'help', 'your_command'];
```

### Thay Đổi Thời Gian Chạy Daily Countdown

Trong `icls/hdl/handleSchedule.js`, chỉnh sửa cron pattern:

```javascript
cron.schedule('5 0 * * *', async () => {  // 00:05 mỗi ngày
    // Đổi thành '0 12 * * *' để chạy lúc 12:00 trưa
```

### Tùy Chỉnh Thông Báo

Chỉnh sửa các message templates trong:
- `modules/commands/redkey.js`
- `modules/commands/checkkey.js`
- `modules/events/licenseCountdown.js`
- `icls/hdl/handleCommand.js`

## 🛡️ Tính Năng Bảo Mật

### Chống Gian Lận
- ✅ Random key ID generation
- ✅ Log tất cả invalid key attempts
- ✅ Key chỉ dùng được cho đúng target (user/group)
- ✅ Validation key type và target matching

### Audit Trail
- ✅ Log tất cả hoạt động key trong `icls/license_requests.json`
- ✅ Log fraud attempts trong `icls/fraud_attempts.json`
- ✅ Daily countdown logs trong `icls/license_countdown_log.json`

## 📁 Cấu Trúc Files

```
your_bot/
├── modules/
│   ├── commands/
│   │   ├── redkey.js          # Admin key management
│   │   └── checkkey.js        # User key activation
│   └── events/
│       └── licenseCountdown.js # Daily countdown system
├── icls/
│   ├── db/
│   │   ├── models/
│   │   │   └── license_keys.js # Database model
│   │   └── model.js           # Updated model registry
│   └── hdl/
│       ├── handleCommand.js   # Updated with validation
│       └── handleSchedule.js  # Updated with daily cron
└── logs/ (auto-created)
    ├── license_requests.json
    ├── fraud_attempts.json
    └── license_countdown_log.json
```

## 🔄 Flow Hoạt Động

### Khi Người Dùng Chưa Có Key:
1. User dùng bất kỳ lệnh nào
2. Bot check license → Không có key hợp lệ
3. Bot gửi thông báo yêu cầu đến admin
4. Bot trả về message "Bot đang bị khóa"
5. Admin tạo key và gửi lại

### Khi Admin Tạo Key:
1. Admin dùng `!redkey [ngày] [type] [target] [tên]`
2. System tạo random key ID
3. Lưu vào database với trạng thái inactive
4. Trả về key cho admin

### Khi User Kích Hoạt Key:
1. User dùng `!checkkey [keyID]`
2. System validate key và target
3. Activate key và cập nhật bot name (nếu group)
4. Unlock tất cả tính năng bot

### Daily Countdown:
1. Chạy tự động lúc 00:05 mỗi ngày
2. Giảm remainingDays của tất cả active keys
3. Cập nhật bot name với số ngày mới
4. Gửi warning khi sắp hết hạn (≤3 ngày)
5. Auto-expire và lock bot khi hết hạn

## 🚨 Troubleshooting

### Lỗi Database
```javascript
// Kiểm tra model đã được sync chưa
console.log(models.use('LicenseKeys'));
```

### Lỗi Cron Job
```javascript
// Kiểm tra node-cron đã được cài đặt
const cron = require('node-cron');
console.log(cron.validate('5 0 * * *')); // Should return true
```

### Lỗi Permission
```javascript
// Kiểm tra admin config
console.log(global.config.NDH); // Array of admin IDs
```

## 📞 Hỗ Trợ

- **GitHub Issues:** [Tạo issue mới](https://github.com/your-repo/issues)
- **Facebook:** Kaori Waguri
- **Email:** [Your Email]

## 📄 License

MIT License - Free for personal and commercial use

---

**⚡ Powered by Kaori Waguri License System**

> Hệ thống này được thiết kế để hoạt động với mọi Facebook Messenger Bot được xây dựng bằng NodeJS. Dễ dàng tích hợp và tùy chỉnh theo nhu cầu của bạn.
