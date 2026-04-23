const { Worker } = require("bullmq");
const { connection } = require("./config/queue");
const Note = require("./notes/Note");
const { createNotification } = require("./notification/NotificationService");

function startWorker(io) {
    new Worker(
        "alarm-queue",
        async (job) => {
            const note = await Note.findByPk(job.data.noteId);
            if (!note) return;

            // 🚨 IMPORTANT: check if alarm still valid
            if (!note.alarmAt) {
                console.log("⛔ Alarm removed, skipping job:", note.id);
                return;
            }

            const now = new Date();
            const alarmTime = new Date(note.alarmAt);

            // If alarm was updated to a future time → skip
            if (alarmTime > now) {
                console.log("⛔ Alarm updated, skipping outdated job:", note.id);
                return;
            }

            // ✅ Only valid alarms reach here
            const notification = await createNotification({
                title: "Alarm pour une note",
                description: `Votre note intitulée "${note.title}" a été déclenchée`,
                userId: note.creator,
                meetingId: note.meeting || null,
                noteId: note.id
            });

            io.to(note.creator).emit("newNotification", notification);

            console.log("⏰ Alarm:", note.title);
        },
        { connection }
    );

    console.log("🚀 Worker started...");
}

module.exports = startWorker;
