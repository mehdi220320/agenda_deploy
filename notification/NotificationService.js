const Notification = require("./Notification");
const { getIO } = require("../socket");

class NotificationService {

    static async createNotification({ title, description, userId ,meetingId}) {
        try {

            const notification = await Notification.create({
                title:title,
                description:description,
                user: userId,
                meeting:meetingId
            });

            const io = getIO();
            console.log('Emitting notification to user:', userId);
            io.to(userId).emit("newNotification", notification);

            return notification;
        } catch (err) {
            console.error("Error creating notification:", err);
            throw err;
        }
    }


    static async getNotificationsForUser(userId) {
        return Notification.findAll({
            where: { user: userId },
            order: [["createdAt", "DESC"]]
        });
    }
}

module.exports = NotificationService;