const fs = require('fs');
const moment = require('moment-timezone');

module.exports.config = {
    name: "licenseCountdown",
    eventType: [""],
    version: "1.0.0",
    credits: "Kaori Waguri",
    description: "Daily countdown system for license keys with automatic bot name updates"
};

module.exports.run = async function({ api, models }) {
    // This event handler will be triggered by our daily scheduler
    await performDailyCountdown(api, models);
};

// Function to perform daily countdown updates
async function performDailyCountdown(api, models) {
    try {
        const LicenseKeys = models.use('LicenseKeys');
        
        // Get all active licenses
        const activeLicenses = await LicenseKeys.findAll({
            where: {
                isActive: true,
                remainingDays: { [require('sequelize').Op.gt]: 0 }
            }
        });

        console.log(`[License System] Processing ${activeLicenses.length} active licenses...`);

        for (const license of activeLicenses) {
            const newRemainingDays = license.remainingDays - 1;
            
            if (newRemainingDays <= 0) {
                // License expired
                await expireLicense(api, license, LicenseKeys);
            } else {
                // Update remaining days
                await updateLicenseCountdown(api, license, newRemainingDays, LicenseKeys);
            }
        }

        // Log activity
        const logPath = './icls/license_countdown_log.json';
        const logEntry = {
            timestamp: Date.now(),
            processedLicenses: activeLicenses.length,
            date: moment().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss')
        };

        let logs = [];
        if (fs.existsSync(logPath)) {
            try {
                logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            } catch (e) {}
        }
        logs.push(logEntry);
        
        // Keep only last 30 days of logs
        logs = logs.slice(-30);
        fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));

        console.log(`[License System] Daily countdown completed successfully`);

    } catch (error) {
        console.error("[License System] Error in daily countdown:", error);
    }
}

// Expire a license
async function expireLicense(api, license, LicenseKeys) {
    try {
        console.log(`[License System] Expiring license ${license.keyId.substring(0, 8)}...`);

        // Update license as expired
        await LicenseKeys.update(
            {
                remainingDays: 0,
                isActive: false,
                data: JSON.stringify({
                    ...JSON.parse(license.data || '{}'),
                    expiredAt: Date.now()
                })
            },
            { where: { keyId: license.keyId } }
        );

        // Reset bot name for group licenses
        if (license.keyType === "group") {
            try {
                const botName = global.config.BOTNAME;
                await api.changeNickname(botName, license.targetId, api.getCurrentUserID());
                console.log(`[License System] Reset bot name in group ${license.targetId}`);
            } catch (e) {
                console.log(`[License System] Could not reset bot name in group ${license.targetId}:`, e);
            }
        }

        // Send expiration notification
        const expirationMessage = 
            "⏰ **LICENSE HẾT HẠN**\n" +
            "─────────────────────────\n" +
            "❌ License key của bạn đã hết hạn\n" +
            "🔒 Bot đã được khóa lại\n" +
            "💡 Liên hệ admin để gia hạn\n" +
            "─────────────────────────\n" +
            "🙏 Cảm ơn bạn đã sử dụng dịch vụ!";

        try {
            await api.sendMessage(expirationMessage, license.targetId);
        } catch (e) {
            console.log(`[License System] Could not send expiration message to ${license.targetId}:`, e);
        }

        // Notify admin about expiration
        try {
            const adminConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
            const admins = [...(adminConfig.NDH || []), ...(adminConfig.ADMINBOT || [])];
            
            const adminNotification = 
                "📊 **THÔNG BÁO HẾT HẠN LICENSE**\n" +
                "─────────────────────────\n" +
                `🆔 Key ID: ${license.keyId.substring(0, 8)}...\n` +
                `${license.keyType === "personal" ? "👤" : "👥"} Type: ${license.keyType}\n` +
                `🎯 Target: ${license.targetName || license.targetId}\n` +
                `📅 Expired: ${moment().tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}\n` +
                "─────────────────────────\n" +
                "💡 Khách hàng có thể cần gia hạn";

            for (const adminID of admins) {
                try {
                    await api.sendMessage(adminNotification, adminID);
                } catch (e) {
                    console.log(`[License System] Could not notify admin ${adminID}:`, e);
                }
            }
        } catch (e) {
            console.log("[License System] Error notifying admins about expiration:", e);
        }

    } catch (error) {
        console.error(`[License System] Error expiring license ${license.keyId}:`, error);
    }
}

// Update license countdown and bot name
async function updateLicenseCountdown(api, license, newRemainingDays, LicenseKeys) {
    try {
        // Update remaining days in database
        await LicenseKeys.update(
            { remainingDays: newRemainingDays },
            { where: { keyId: license.keyId } }
        );

        // Update bot name for group licenses
        if (license.keyType === "group") {
            try {
                const prefix = global.config.PREFIX || "!";
                const botName = global.config.BOTNAME;
                const newName = `${prefix} ${botName} [${newRemainingDays} ngày]`;
                await api.changeNickname(newName, license.targetId, api.getCurrentUserID());
                console.log(`[License System] Updated bot name in group ${license.targetId}: ${newRemainingDays} days`);
            } catch (e) {
                console.log(`[License System] Could not update bot name in group ${license.targetId}:`, e);
            }
        }

        // Send warning notifications for licenses expiring soon
        if (newRemainingDays <= 3 && newRemainingDays > 0) {
            const warningMessage = 
                "⚠️ **CẢNH BÁO SẮP HẾT HẠN**\n" +
                "─────────────────────────\n" +
                `⏰ License của bạn còn ${newRemainingDays} ngày\n` +
                "📱 Vui lòng liên hệ admin để gia hạn\n" +
                "🔓 Bot vẫn hoạt động bình thường\n" +
                "─────────────────────────\n" +
                "💡 Gia hạn sớm để tránh gián đoạn dịch vụ";

            try {
                await api.sendMessage(warningMessage, license.targetId);
            } catch (e) {
                console.log(`[License System] Could not send warning to ${license.targetId}:`, e);
            }
        }

        console.log(`[License System] Updated license ${license.keyId.substring(0, 8)}: ${newRemainingDays} days remaining`);

    } catch (error) {
        console.error(`[License System] Error updating license ${license.keyId}:`, error);
    }
}

// Export the main function for external use (scheduler)
module.exports.performDailyCountdown = performDailyCountdown;