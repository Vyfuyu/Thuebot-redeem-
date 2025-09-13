const fs = require('fs');

module.exports.config = {
    name: "checkkey",
    version: "1.0.0",
    hasPermssion: 0, // Everyone can use
    credits: "Kaori Waguri", 
    description: "Activate bot license key to unlock all features",
    commandCategory: "System",
    usages: "[keyID]",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args, models }) {
    const { senderID, threadID, messageID } = event;
    const LicenseKeys = models.use('LicenseKeys');
    
    try {
        const keyId = args[0];
        
        if (!keyId) {
            return api.sendMessage(
                "🔑 **KÍCH HOẠT LICENSE KEY**\n" +
                "─────────────────────────\n" +
                "📝 Cách sử dụng: `!checkkey [KeyID]`\n" +
                "💡 Ví dụ: `!checkkey ABC123DEF456`\n" +
                "─────────────────────────\n" +
                "❓ Không có key? Liên hệ admin để thuê bot!",
                threadID, messageID
            );
        }

        // Find the key
        const key = await LicenseKeys.findOne({
            where: { keyId: keyId.toUpperCase() }
        });

        if (!key) {
            // Anti-fraud: Log invalid key attempts
            const attemptData = {
                timestamp: Date.now(),
                senderID: senderID,
                threadID: threadID,
                invalidKey: keyId,
                userInfo: null
            };

            try {
                attemptData.userInfo = await api.getUserInfo(senderID);
            } catch (e) {}

            // Save to fraud log
            const fraudLogPath = './icls/fraud_attempts.json';
            let fraudLog = [];
            if (fs.existsSync(fraudLogPath)) {
                try {
                    fraudLog = JSON.parse(fs.readFileSync(fraudLogPath, 'utf8'));
                } catch (e) {}
            }
            fraudLog.push(attemptData);
            fs.writeFileSync(fraudLogPath, JSON.stringify(fraudLog, null, 2));

            return api.sendMessage(
                "❌ **KEY KHÔNG HỢP LỆ**\n" +
                "─────────────────────────\n" +
                "🔍 Key bạn nhập không tồn tại trong hệ thống\n" +
                "⚠️ Lần thử này đã được ghi lại\n" +
                "─────────────────────────\n" +
                "💡 Vui lòng kiểm tra lại key hoặc liên hệ admin",
                threadID, messageID
            );
        }

        // Check key type and target matching
        const isPersonalKey = key.keyType === "personal";
        const isGroupKey = key.keyType === "group";
        
        if (isPersonalKey && key.targetId !== senderID) {
            return api.sendMessage(
                "❌ **KEY KHÔNG KHỚP**\n" +
                "─────────────────────────\n" +
                "👤 Đây là key cá nhân không dành cho bạn\n" +
                "⚠️ Chỉ người được chỉ định mới có thể sử dụng\n" +
                "─────────────────────────\n" +
                "💡 Vui lòng sử dụng key của riêng bạn",
                threadID, messageID
            );
        }

        if (isGroupKey && key.targetId !== threadID) {
            return api.sendMessage(
                "❌ **KEY KHÔNG KHỚP**\n" +
                "─────────────────────────\n" +
                "👥 Đây là key nhóm không dành cho nhóm này\n" +
                "⚠️ Key chỉ có thể sử dụng trong nhóm được chỉ định\n" +
                "─────────────────────────\n" +
                "💡 Sử dụng key trong đúng nhóm được cấp",
                threadID, messageID
            );
        }

        // Check if key is already activated
        if (key.isActive) {
            const typeText = key.keyType === "personal" ? "👤 Cá nhân" : "👥 Nhóm";
            return api.sendMessage(
                "⚠️ **KEY ĐÃ ĐƯỢC KÍCH HOẠT**\n" +
                "─────────────────────────\n" +
                `${typeText} | 📅 Còn lại: ${key.remainingDays} ngày\n` +
                `🎯 Target: ${key.targetName || key.targetId}\n` +
                "─────────────────────────\n" +
                "✅ Bot đang hoạt động bình thường\n" +
                "🔓 Tất cả tính năng đã được mở khóa",
                threadID, messageID
            );
        }

        // Activate the key
        await LicenseKeys.update(
            {
                isActive: true,
                activatedAt: new Date(),
                data: JSON.stringify({
                    ...JSON.parse(key.data || '{}'),
                    activatedBy: senderID,
                    activatedAt: Date.now()
                })
            },
            { where: { keyId: key.keyId } }
        );

        // Update bot name for group keys
        if (isGroupKey) {
            try {
                const prefix = global.config.PREFIX || "!";
                const botName = global.config.BOTNAME;
                const newName = `${prefix} ${botName} [${key.remainingDays} ngày]`;
                await api.changeNickname(newName, threadID, api.getCurrentUserID());
            } catch (e) {
                console.log("Could not change bot name:", e);
            }
        }

        // Enable license system globally
        global.licenseSystem = {
            enabled: true,
            enabledAt: Date.now()
        };

        // Save active licenses to global for quick access
        if (!global.activeLicenses) {
            global.activeLicenses = new Map();
        }
        
        const licenseKey = isPersonalKey ? `personal_${senderID}` : `group_${threadID}`;
        global.activeLicenses.set(licenseKey, {
            keyId: key.keyId,
            type: key.keyType,
            targetId: key.targetId,
            remainingDays: key.remainingDays,
            activatedAt: Date.now()
        });

        const typeText = key.keyType === "personal" ? "👤 Cá nhân" : "👥 Nhóm";
        const message = 
            "🎉 **KEY ĐÃ ĐƯỢC KÍCH HOẠT THÀNH CÔNG!**\n" +
            "─────────────────────────\n" +
            `🆔 Key ID: ${key.keyId.substring(0, 8)}...\n` +
            `${typeText} | 📅 ${key.remainingDays} ngày\n` +
            `🎯 Target: ${key.targetName || key.targetId}\n` +
            "─────────────────────────\n" +
            "🔓 **TẤT CẢ TÍNH NĂNG ĐÃ ĐƯỢC MỞ KHÓA!**\n" +
            "✅ Bot đã sẵn sàng phục vụ bạn\n" +
            "📱 Sử dụng `help` để xem danh sách lệnh\n" +
            "⏰ Thời gian sử dụng sẽ được cập nhật hàng ngày\n" +
            "─────────────────────────\n" +
            "🙏 Cảm ơn bạn đã sử dụng dịch vụ!";

        return api.sendMessage(message, threadID, messageID);

    } catch (error) {
        console.error("Error in checkkey command:", error);
        return api.sendMessage(
            "❌ **LỖI HỆ THỐNG**\n" +
            "─────────────────────────\n" +
            "⚠️ Có lỗi xảy ra khi kích hoạt key\n" +
            "🔧 Vui lòng thử lại sau hoặc liên hệ admin\n" +
            "─────────────────────────\n" +
            "💡 Đảm bảo key được nhập chính xác",
            threadID, messageID
        );
    }
};