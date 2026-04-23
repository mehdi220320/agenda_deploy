const express = require('express');
const router = express.Router();
const Note = require('./Note');
const { authentication } = require('../middleware/authMiddleware');
const { alarmQueue } = require("../config/queue.js");
router.get('/myNotes', authentication, async (req, res) => {
    try {
        const id = req.user.userId;
        const notes = await Note.findAll({
            where: { creator: id },
            order: [['createdAt', 'DESC']]
        });
        res.json(notes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/myNotes/:i', authentication, async (req, res) => {
    try {
        const id = req.user.userId;
        const i = parseInt(req.params.i) || 1;

        const limit = 5;
        const offset = (i - 1) * limit;

        const total = await Note.count({
            where: { creator: id }
        });

        const notes = await Note.findAll({
            where: { creator: id },
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        const hasMore = offset + notes.length < total;

        res.json({
            notes,
            currentPage: i,
            totalNotes: total,
            hasMore
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/add', authentication, async (req, res) => {
    try {
        const id = req.user.userId;
        const { description, client, meeting, title,alarmAt } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: "Le titre et la description sont requis" });
        }

        const note = await Note.create({
            title: title,
            description: description,
            creator: id,
            client: client || null,
            meeting: meeting || null,
            alarmAt: alarmAt || null
        });

        if(alarmAt){
            const delay = new Date(note.alarmAt) - new Date();

            if (delay > 0) {
                await alarmQueue.add(
                    "alarm-job",
                    { noteId: note.id },
                    { delay,jobId:note.id }
                );
            }
        }
        res.json(note);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/edit/:id', authentication, async (req, res) => {
    try {
        const userId = req.user.userId;
        const noteId = req.params.id;
        const { title, description, client, meeting,alarmAt } = req.body;

        const note = await Note.findByPk(noteId);

        if (!note) {
            return res.status(404).json({ error: "Note non trouvée" });
        }

        if (note.creator !== userId) {
            return res.status(403).json({ error: "Vous n'êtes pas autorisé à modifier cette note" });
        }

        if (title !== undefined) note.title = title;
        if (description !== undefined) note.description = description;
        if (client !== undefined) note.client = client;
        if (meeting !== undefined) note.meeting = meeting;
        if (alarmAt !== undefined) {
            note.alarmAt = alarmAt;

            const job = await alarmQueue.getJob(note.id);
            if (job) await job.remove();

            if (alarmAt) {
                const delay = new Date(alarmAt) - new Date();

                if (delay > 0) {
                    await alarmQueue.add("alarm-job", {
                        noteId: note.id
                    }, {
                        delay,
                        jobId: note.id
                    });
                }
            }
        }
        await note.save();
        res.json(note);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/delete/:id', authentication, async (req, res) => {
    try {
        const userId = req.user.userId;
        const noteId = req.params.id;

        const note = await Note.findByPk(noteId);

        if (!note) {
            return res.status(404).json({ error: "Note non trouvée" });
        }

        if (note.creator !== userId) {
            return res.status(403).json({ error: "Vous n'êtes pas autorisé à supprimer cette note" });
        }

        await note.destroy();
        res.json({ message: "Note supprimée avec succès" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


module.exports = router;