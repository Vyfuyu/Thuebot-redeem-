const fs = require('fs');
const crypto = require('crypto');

module.exports.config = {
    name: "redkey",
    version: "1.0.0",
    hasPermssion: 2, // Admin only
    credits: "Kaori Waguri",
    description: "Admin command to generate license keys for bot rental system",
    commandCategory: "Admin",
    usages: "[days] [personal/group] [targetID] [targetName] | list | cancel [keyID] | reset",
    cooldowns: 2
};

module.exports.run = async function({ api, event, args, models }) {
    const { senderID, threadID, messageID } = event;
    const LicenseKeys = models.use('LicenseKeys');
    
    // Check if user is admin
    const adminConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    const senderIDStr = String(senderID);
    const admins = (adminConfig.NDH || []).map(String);
    const botAdmins = (adminConfig.ADMINBOT || []).map(String);
    if (!admins.includes(senderIDStr) && !botAdmins.includes(senderIDStr)) {
        return api.sendMessage("❌ Chỉ admin mới có thể sử dụng lệnh này!", threadID, messageID);
    }

    try {
        const action = args[0]?.toLowerCase();

        if (!action) {
            return api.sendMessage(
                "🔑 **HỆ THỐNG REDEEM KEY BOT**\n" +
                "─────────────────────────\n" +
                "📝 Cách sử dụng:\n" +
                "• `redkey [số ngày] personal [userID] [tên]` - Tạo key cá nhân\n" +
                "• `redkey [số ngày] group [threadID] [tên nhóm]` - Tạo key nhóm\n" +
                "• `redkey list` - Xem danh sách key\n" +
                "• `redkey cancel [keyID]` - Hủy key\n" +
                "• `redkey reset` - Reset toàn bộ hệ thống\n" +
                "─────────────────────────\n" +
                "💡 Ví dụ: `redkey 30 group 123456789 Nhóm ABC`",
                threadID, messageID
            );
        }

        // List all keys
        if (action === "list") {
            const allKeys = await LicenseKeys.findAll();
            if (allKeys.length === 0) {
                return api.sendMessage("📋 Không có key nào trong hệ thống.", threadID, messageID);
            }

            let message = "🔑 **DANH SÁCH LICENSE KEYS**\n";
            message += "─────────────────────────\n";
            
            for (const key of allKeys) {
                const status = key.isActive ? "🟢 Đã kích hoạt" : "🟡 Chưa kích hoạt";
                const type = key.keyType === "personal" ? "👤 Cá nhân" : "👥 Nhóm";
                const remaining = key.isActive ? `${key.remainingDays} ngày còn lại` : `${key.expirationDays} ngày`;
                
                message += `🆔 ${key.keyId.substring(0, 8)}...\n`;
                message += `${type} | ${status}\n`;
                message += `📅 ${remaining} | 🎯 ${key.targetName || key.targetId}\n`;
                message += "─────────────────────────\n";
            }
            
            return api.sendMessage(message, threadID, messageID);
        }

        // Cancel a key
        if (action === "cancel") {
            const keyId = args[1];
            if (!keyId) {
                return api.sendMessage("❌ Vui lòng nhập ID key cần hủy!", threadID, messageID);
            }

            const key = await LicenseKeys.findOne({ where: { keyId: { [require('sequelize').Op.like]: `${keyId}%` } } });
            if (!key) {
                return api.sendMessage("❌ Không tìm thấy key với ID này!", threadID, messageID);
            }

            await LicenseKeys.destroy({ where: { keyId: key.keyId } });
            
            // Reset bot name if it was active
            if (key.isActive && key.keyType === "group") {
                try {
                    const botName = global.config.BOTNAME;
                    await api.changeNickname(botName, key.targetId, api.getCurrentUserID());
                } catch (e) {}
            }

            return api.sendMessage(
                `✅ Đã hủy key thành công!\n` +
                `🆔 Key ID: ${key.keyId.substring(0, 8)}...\n` +
                `🎯 Target: ${key.targetName || key.targetId}`,
                threadID, messageID
            );
        }

        // Reset system
        if (action === "reset") {
            const allKeys = await LicenseKeys.findAll({ where: { isActive: true } });
            
            // Reset all bot names
            for (const key of allKeys) {
                if (key.keyType === "group") {
                    try {
                        const botName = global.config.BOTNAME;
                        await api.changeNickname(botName, key.targetId, api.getCurrentUserID());
                    } catch (e) {}
                }
            }
            
            await LicenseKeys.destroy({ where: {} });
            
            // Disable license system globally
            global.licenseSystem = {
                enabled: false,
                resetAt: Date.now()
            };
            
            return api.sendMessage(
                "🔄 **HỆ THỐNG ĐÃ ĐƯỢC RESET**\n" +
                "─────────────────────────\n" +
                "✅ Đã xóa tất cả license keys\n" +
                "✅ Đã reset tên bot trong các nhóm\n" +
                "✅ Bot chuyển về chế độ public\n" +
                "─────────────────────────\n" +
                "💡 Sử dụng `redkey` để bắt đầu lại hệ thống",
                threadID, messageID
            );
        }

        // Generate new key
        const days = parseInt(args[0]);
        const type = args[1]?.toLowerCase();
        const targetId = args[2];
        const targetName = args.slice(3).join(" ");

        if (!days || days <= 0) {
            return api.sendMessage("❌ Số ngày phải là số dương!", threadID, messageID);
        }

        if (!["personal", "group"].includes(type)) {
            return api.sendMessage("❌ Loại key phải là 'personal' hoặc 'group'!", threadID, messageID);
        }

        if (!targetId) {
            return api.sendMessage("❌ Vui lòng nhập ID đích (userID hoặc threadID)!", threadID, messageID);
        }

        // Generate unique key ID
        const keyId = crypto.randomBytes(16).toString('hex').toUpperCase();
        
        // Check if target already has an active key
        const existingKey = await LicenseKeys.findOne({
            where: {
                targetId: targetId,
                keyType: type,
                isActive: true
            }
        });

        if (existingKey) {
            return api.sendMessage(
                `❌ Target này đã có key đang hoạt động!\n` +
                `🆔 Key ID: ${existingKey.keyId.substring(0, 8)}...\n` +
                `📅 Còn lại: ${existingKey.remainingDays} ngày`,
                threadID, messageID
            );
        }

        // Create new key
        await LicenseKeys.create({
            keyId: keyId,
            keyType: type,
            targetId: targetId,
            targetName: targetName || null,
            expirationDays: days,
            remainingDays: days,
            isActive: false,
            createdBy: senderID,
            data: JSON.stringify({
                createdAt: Date.now(),
                originalDays: days
            })
        });

        // Enable license system globally
        global.licenseSystem = {
            enabled: true,
            enabledAt: Date.now()
        };

        const typeText = type === "personal" ? "👤 Cá nhân" : "👥 Nhóm";
        const message = 
            "🎉 **KEY ĐÃ ĐƯỢC TẠO THÀNH CÔNG!**\n" +
            "─────────────────────────\n" +
            `🆔 **Key ID:** \`${keyId}\`\n` +
            `${typeText} | 📅 ${days} ngày\n` +
            `🎯 **Target:** ${targetName || targetId}\n` +
            "─────────────────────────\n" +
            "📋 **Hướng dẫn sử dụng:**\n" +
            `• Gửi key này đến ${type === "personal" ? "người dùng" : "nhóm"}\n` +
            "• Họ sử dụng lệnh: `!checkkey " + keyId + "`\n" +
            "• Bot sẽ được unlock toàn bộ tính năng\n" +
            "─────────────────────────\n" +
            "⚡ Hệ thống license đã được kích hoạt!";

        return api.sendMessage(message, threadID, messageID);

    } catch (error) {
        console.error("Error in redkey command:", error);
        return api.sendMessage("❌ Có lỗi xảy ra khi xử lý lệnh!", threadID, messageID);
    }
};