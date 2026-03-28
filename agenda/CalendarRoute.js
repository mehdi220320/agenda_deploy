const express = require("express");
const router = express.Router();
const User=require("../models/User");
const Availability=require("./Availability");
const AvailabilityOverride=require("./AvailabilityOverride");
const BlockedSlot=require("./BlockedSlot");
const Break=require("./Break");
const Meeting=require("../meeting/Meeting");
const { Op } = require("sequelize");

const { authentication } = require('../middleware/authMiddleware');


router.post("/addAvailability",authentication, async (req, res) => {
    try {

        const {dayOfWeek, startTime, endTime, slotDuration } = req.body;
        const userId=req.user.userId;

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }
        const availabilityExist = await Availability.findOne({
            where: { userId: userId }
        });

        if (availabilityExist) {
            return res.status(400).send({ message: 'Availability already exists' });
        }

        const newAvailability = await Availability.create({ userId, dayOfWeek, startTime, endTime, slotDuration });

        res.status(201).send({
            message: "Availability registered successfully",
            Availability: newAvailability
        });
    }
    catch (e) {
        res.status(400).send({ message: e.message });
    }
});


router.patch("/updateAvailability",authentication, async (req, res) => {
    try {
        const availability = await Availability.findOne({
            where: { userId: req.user.userId }
        });

        if (!availability) {
            return res.status(404).send({ message: 'Availability not found' });
        }

        const { dayOfWeek, startTime, endTime, slotDuration } = req.body;
        const newAvailability = await availability.update({ dayOfWeek, startTime, endTime, slotDuration });

        res.status(200).send({
            message: 'Availability updated successfully',
            newAvailability: newAvailability
        });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.get('/Availability',authentication, async (req, res) => {
    try {
        const availability = await Availability.findOne({
            where: { userId: req.user.userId }
        });

        if (!availability) {
            return res.status(404).send({ message: 'Availability not found' });
        }

        res.status(200).send({ availability });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.post("/addBlockedSlot",authentication, async (req, res) => {
    try {
        const { startDateTime, endDateTime, reason } = req.body;
        const userId = req.user.userId;

        if (new Date(startDateTime) >= new Date(endDateTime)) {
            return res.status(400).send({
                message: "Start datetime must be before end datetime"
            });
        }

        const existingSlot = await BlockedSlot.findOne({
            where: {
                userId,
                startDateTime: { [Op.lt]: endDateTime },
                endDateTime:   { [Op.gt]: startDateTime }
            }
        });

        if (existingSlot) {
            return res.status(400).send({
                message: `Blocked slot already exists from ${existingSlot.startDateTime} to ${existingSlot.endDateTime}`
            });
        }

        const newBlockedSlot = await BlockedSlot.create({
            userId,
            startDateTime,
            endDateTime,
            reason
        });

        res.status(201).send({
            message: "BlockedSlot registered successfully",
            blockedSlot: newBlockedSlot
        });

    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.post("/addBreak",authentication, async (req, res) => {
    try {
        const {  startAt, endAt} = req.body;
        const userId=req.user.userId
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }

        const newBreak = await Break.create({
            userId,startAt, endAt
        });

        res.status(201).send({
            message: "Break registered successfully",
            BlockedSlot: newBreak
        });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.patch("/updateBreak",authentication, async (req, res) => {
    try {
        const bbreak= await Break.findOne({
            where: { userId: req.user.userId }
        });

        if (!bbreak) {
            return res.status(404).send({ message: 'Break not found' });
        }

        const { startAt,endAt } = req.body;
        const newBreak = await bbreak.update({startAt,endAt });

        res.status(200).send({
            message: 'Break updated successfully',
            newBreak: newBreak
        });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.delete("/deleteBreak",authentication, async (req, res) => {
    try {
        const bbreak= await Break.findOne({
            where: { userId: req.user.userId }
        });

        if (!bbreak) {
            return res.status(404).send({ message: 'Break not found' });
        }

        await bbreak.destroy();

        res.status(200).send({
            message: 'Break deleted successfully',
        });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.get("/Break",authentication, async (req, res) => {
    try {
        const bbreak= await Break.findOne({
            where: { userId: req.user.userId }
        });

        res.status(200).send({
            bbreak
        });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.get("/allBlockedSlot",authentication, async (req, res) => {
    try {
        const blockedSlot = await BlockedSlot.findAll({
            where: { userId: req.user.userId }
        });

        res.status(200).send({ blockedSlot });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.get("/checkAvailabilityExists",authentication, async (req, res) => {
    try {
        const availability = await Availability.findOne({
            where: { userId: req.user.userId }
        });

        if (availability) {
            res.status(200).send({ message: 'Availability already exists', result: true });
        } else {
            res.status(200).send({ message: 'Availability not found', result: false });
        }
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.delete("/deleteBlockedSlot",authentication, async (req, res) => {
    try {
        const { blockedSlotId } = req.body;
        const blockedSlot = await BlockedSlot.findByPk(blockedSlotId);

        if (!blockedSlot) {
            return res.status(404).send({ message: 'BlockedSlot not found' });
        }

        await blockedSlot.destroy();
        res.status(200).send({ message: 'BlockedSlot deleted successfully' });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.get("/disponibility",authentication, async (req, res) => {
    try {
        const userId=req.user.userId;
        const blockedSlots = await BlockedSlot.findAll({
            where: {
                userId: userId,
                startDateTime: {
                    [Op.gte]: new Date().setHours(0, 0, 0, 0)
                }
            }
        });
        const availability = await Availability.findOne({
            where: { userId: userId }
        });
        const availabilityoverride = await AvailabilityOverride.findAll({
            where: {
                userId: userId,
                day: {
                    [Op.gte]: new Date().setHours(0, 0, 0, 0)
                }
            }
        });
        const bbreak = await Break.findOne({
            where: { userId: userId }
        });
        res.status(200).send({
            blockSlots: blockedSlots,
            availability: availability,
            availabilityoverride:availabilityoverride,
            break: bbreak
        });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.post("/addAvailabilityOverride",authentication, async (req, res) => {
    try {
        const { day, workingTimes } = req.body;
        const userId = req.user.userId;

        const existingOverride = await AvailabilityOverride.findOne({
            where: {
                userId,
                day
            }
        });

        if (existingOverride) {
            return res.status(400).send({
                message: `An override already exists for ${day}, use the update route instead`
            });
        }

        const newOverride = await AvailabilityOverride.create({
            userId,
            day,
            workingTimes
        });

        res.status(201).send({
            message: "AvailabilityOverride created successfully",
            availabilityOverride: newOverride
        });

    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.patch("/updateAvailabilityOverride/:id",authentication, async (req, res) => {
    try {
        const { id } = req.params;
        const { day, workingTimes } = req.body;
        const userId = req.user.userId;

        const override = await AvailabilityOverride.findOne({
            where: { id, userId }
        });

        if (!override) {
            return res.status(404).send({ message: 'AvailabilityOverride not found' });
        }

        const updatedOverride = await override.update({
            ...(day && { day }),
            ...(workingTimes && { workingTimes })
        });

        res.status(200).send({
            message: 'AvailabilityOverride updated successfully',
            availabilityOverride: updatedOverride
        });

    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.delete("/deleteAvailabilityOverride/:id",authentication, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const override = await AvailabilityOverride.findOne({
            where: { id, userId }
        });

        if (!override) {
            return res.status(404).send({ message: 'AvailabilityOverride not found' });
        }

        await override.destroy();

        res.status(200).send({ message: 'AvailabilityOverride deleted successfully' });

    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});

router.get("/disponibility/:id", async (req, res) => {
    try {
        const userId=req.params.id;
        const blockedSlots = await BlockedSlot.findAll({
            where: {
                userId: userId,
                startDateTime: {
                    [Op.gte]: new Date().setHours(0, 0, 0, 0)
                }
            }
        });
        const availability = await Availability.findOne({
            where: { userId: userId }
        });
        const availabilityoverride = await AvailabilityOverride.findAll({
            where: {
                userId: userId,
                day: {
                    [Op.gte]: new Date().setHours(0, 0, 0, 0)
                }
            }
        });
        const bbreak = await Break.findOne({
            where: { userId: userId }
        });
        const meetings=await Meeting.findAll({
            where:{
                expert: userId,
                date: {
                    [Op.gte]: new Date().setHours(0, 0, 0, 0)
                }
            }
        })
        res.status(200).send({
            blockSlots: blockedSlots,
            availability: availability,
            availabilityoverride:availabilityoverride,
            break: bbreak,
            meetings:meetings
        });
    } catch (e) {
        res.status(400).send({ message: e.message });
    }
});



module.exports = router;

