const Notification = require("./Notification");
const { getIO } = require("../socket");

class NotificationService {

    static async createNotification({ title, description, userId ,meetingId,noteId}) {
        try {

            const notification = await Notification.create({
                title:title,
                description:description,
                user: userId,
                meeting:meetingId? meetingId : null,
                note:noteId? noteId : null,
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