const express = require('express');
const router = express.Router();
const Reclamation = require('./Reclamations');
const { authentication, adminAuthorization } = require('../middleware/authMiddleware');
const  uploadToCloudinary  = require('../config/cloudinary');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });


router.post('/reclamations', authentication, upload.single('picture'), async (req, res) => {
    try {
        const { title, description, category, priority } = req.body;
        const userId = req.user.userId;

        let pictureUrl = null;
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            pictureUrl = result.secure_url;
        }

        const reclamation = await Reclamation.create({
            title,
            description,
            user: userId,
            category: category || 'other',
            priority: priority || 'medium',
            picture: pictureUrl,
            status: 'pending',
            date: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Reclamation created successfully',
            data: reclamation
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/my-reclamations', authentication, async (req, res) => {
    try {
        const userId = req.user.userId;
        const reclamations = await Reclamation.findAll({
            where: { user: userId },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: reclamations
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/reclamations/:id', authentication, async (req, res) => {
    try {
        const { id } = req.params;
        const reclamation = await Reclamation.findByPk(id);

        if (!reclamation) {
            return res.status(404).json({
                success: false,
                message: 'Reclamation not found'
            });
        }

        // Check if user owns this reclamation or is admin
        if (req.user.role !== 'admin' && reclamation.user !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.status(200).json({
            success: true,
            data: reclamation
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.put('/reclamations/:id', authentication, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, priority } = req.body;

        const reclamation = await Reclamation.findByPk(id);

        if (!reclamation) {
            return res.status(404).json({
                success: false,
                message: 'Reclamation not found'
            });
        }

        if (reclamation.user !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own reclamations'
            });
        }

        if (reclamation.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update reclamation that is already being processed'
            });
        }

        await reclamation.update({
            title: title || reclamation.title,
            description: description || reclamation.description,
            category: category || reclamation.category,
            priority: priority || reclamation.priority
        });

        res.status(200).json({
            success: true,
            message: 'Reclamation updated successfully',
            data: reclamation
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.delete('/reclamations/:id', authentication, async (req, res) => {
    try {
        const { id } = req.params;
        const reclamation = await Reclamation.findByPk(id);

        if (!reclamation) {
            return res.status(404).json({
                success: false,
                message: 'Reclamation not found'
            });
        }

        if (reclamation.user !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await reclamation.destroy();

        res.status(200).json({
            success: true,
            message: 'Reclamation deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


router.get('/admin/reclamations', authentication, adminAuthorization, async (req, res) => {
    try {
        const { status, priority, category } = req.query;
        const where = {};

        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (category) where.category = category;

        const reclamations = await Reclamation.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: reclamations
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/admin/reclamations/:id/respond', authentication, adminAuthorization, upload.single('responsePicture'), async (req, res) => {
    try {
        const { id } = req.params;
        const { response } = req.body;
        const adminId = req.user.userId;

        if (!response) {
            return res.status(400).json({
                success: false,
                message: 'Response text is required'
            });
        }

        const reclamation = await Reclamation.findByPk(id);

        if (!reclamation) {
            return res.status(404).json({
                success: false,
                message: 'Reclamation not found'
            });
        }

        let responsePictureUrl = null;
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            responsePictureUrl = result.secure_url;
        }

        await reclamation.update({
            adminResponse: response,
            adminResponsePicture: responsePictureUrl,
            adminResponseDate: new Date(),
            respondedBy: adminId,
            status: 'resolved'
        });

        res.status(200).json({
            success: true,
            message: 'Response sent successfully',
            data: reclamation
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.patch('/admin/reclamations/:id/status', authentication, adminAuthorization, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'in_progress', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const reclamation = await Reclamation.findByPk(id);

        if (!reclamation) {
            return res.status(404).json({
                success: false,
                message: 'Reclamation not found'
            });
        }

        await reclamation.update({
            status,
            resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : null
        });

        res.status(200).json({
            success: true,
            message: 'Status updated successfully',
            data: reclamation
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.patch('/admin/reclamations/:id/priority', authentication, adminAuthorization, async (req, res) => {
    try {
        const { id } = req.params;
        const { priority } = req.body;

        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        if (!validPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid priority'
            });
        }

        const reclamation = await Reclamation.findByPk(id);

        if (!reclamation) {
            return res.status(404).json({
                success: false,
                message: 'Reclamation not found'
            });
        }

        await reclamation.update({ priority });

        res.status(200).json({
            success: true,
            message: 'Priority updated successfully',
            data: reclamation
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/admin/reclamations/statistics/summary', authentication, adminAuthorization, async (req, res) => {
    try {
        const total = await Reclamation.count();
        const pending = await Reclamation.count({ where: { status: 'pending' } });
        const inProgress = await Reclamation.count({ where: { status: 'in_progress' } });
        const resolved = await Reclamation.count({ where: { status: 'resolved' } });
        const closed = await Reclamation.count({ where: { status: 'closed' } });

        const byPriority = {
            low: await Reclamation.count({ where: { priority: 'low' } }),
            medium: await Reclamation.count({ where: { priority: 'medium' } }),
            high: await Reclamation.count({ where: { priority: 'high' } }),
            urgent: await Reclamation.count({ where: { priority: 'urgent' } })
        };

        const byCategory = {
            technical: await Reclamation.count({ where: { category: 'technical' } }),
            billing: await Reclamation.count({ where: { category: 'billing' } }),
            service: await Reclamation.count({ where: { category: 'service' } }),
            other: await Reclamation.count({ where: { category: 'other' } })
        };

        res.status(200).json({
            success: true,
            data: {
                total,
                pending,
                inProgress,
                resolved,
                closed,
                byPriority,
                byCategory
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.delete('/admin/reclamations/:id', authentication, adminAuthorization, async (req, res) => {
    try {
        const { id } = req.params;
        const reclamation = await Reclamation.findByPk(id);

        if (!reclamation) {
            return res.status(404).json({
                success: false,
                message: 'Reclamation not found'
            });
        }

        await reclamation.destroy();

        res.status(200).json({
            success: true,
            message: 'Reclamation deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;