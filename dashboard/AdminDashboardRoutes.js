const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Reclamation = require('../reclamations/Reclamations');
const Meeting = require('../meeting/Meeting');
const { adminAuthorization } = require('../middleware/authMiddleware');
const Token = require('../models/Token');
const { col, fn, Op } = require("sequelize");

// Your existing /counts route
router.get('/counts', adminAuthorization, async (req, res) => {
    try {
        const now = new Date();

        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const startOfThisMonthCopy = new Date(now.getFullYear(), now.getMonth(), 1);

        const calcRate = (current, previous) => {
            if (previous === 0) return current === 0 ? 0 : 100;
            return ((current - previous) / previous) * 100;
        };

        const [
            usersCounts,
            totalUsers,
            usersThisMonth,
            usersLastMonth,
            totalReclamations,
            reclamationsThisMonth,
            reclamationsLastMonth,
            totalMeetings,
            meetingsThisMonth,
            meetingsLastMonth
        ] = await Promise.all([
            User.findAll({
                where: { role: { [Op.in]: ["user", "expert"] } },
                attributes: ['role', [fn('COUNT', col('role')), 'count']],
                group: ['role']
            }),
            User.count(),
            User.count({
                where: {
                    createdAt: { [Op.gte]: startOfThisMonth, [Op.lt]: startOfNextMonth }
                }
            }),
            User.count({
                where: {
                    createdAt: { [Op.gte]: startOfLastMonth, [Op.lt]: startOfThisMonthCopy }
                }
            }),
            Reclamation.count(),
            Reclamation.count({
                where: {
                    createdAt: { [Op.gte]: startOfThisMonth, [Op.lt]: startOfNextMonth }
                }
            }),
            Reclamation.count({
                where: {
                    createdAt: { [Op.gte]: startOfLastMonth, [Op.lt]: startOfThisMonthCopy }
                }
            }),
            Meeting.count(),
            Meeting.count({
                where: {
                    createdAt: { [Op.gte]: startOfThisMonth, [Op.lt]: startOfNextMonth }
                }
            }),
            Meeting.count({
                where: {
                    createdAt: { [Op.gte]: startOfLastMonth, [Op.lt]: startOfThisMonthCopy }
                }
            })
        ]);

        const formattedUsers = Object.fromEntries(
            usersCounts.map(u => [u.role, Number(u.get('count'))])
        );

        res.status(200).json({
            users: {
                total: totalUsers,
                byRole: formattedUsers,
                thisMonth: usersThisMonth,
                lastMonth: usersLastMonth,
                taux: calcRate(usersThisMonth, usersLastMonth)
            },
            reclamations: {
                total: totalReclamations,
                thisMonth: reclamationsThisMonth,
                lastMonth: reclamationsLastMonth,
                taux: calcRate(reclamationsThisMonth, reclamationsLastMonth)
            },
            meetings: {
                total: totalMeetings,
                thisMonth: meetingsThisMonth,
                lastMonth: meetingsLastMonth,
                taux: calcRate(meetingsThisMonth, meetingsLastMonth)
            }
        });

    } catch (e) {
        res.status(500).send({ message: "Error getting stats: " + e.message });
    }
});

// Your existing /expertActivation route
router.get('/expertActivation', adminAuthorization, async (req, res) => {
    try {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - (day === 0 ? 6 : day - 1);
        const startOfWeek = new Date(now.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        const connections = await Token.findAll({
            where: {
                createdAt: {
                    [Op.gte]: startOfWeek
                }
            },
            attributes: [
                [fn('DATE', col('createdAt')), 'day'],
                [fn('COUNT', fn('DISTINCT', col('userId'))), 'count']
            ],
            group: [fn('DATE', col('createdAt'))],
            order: [[fn('DATE', col('createdAt')), 'ASC']]
        });
        const daysMap = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

        const formatted = connections.map(c => {
            const date = new Date(c.get('day'));
            return {
                day: daysMap[date.getDay()],
                count: Number(c.get('count'))
            };
        });
        res.status(200).json(formatted);

    } catch (e) {
        res.status(500).send({ message: "Error getting activate experts stats: " + e.message });
    }
});

// Fixed /reclamation/stats route - REMOVE the include User part if association doesn't exist
router.get('/reclamation/stats', adminAuthorization, async (req, res) => {
    try {
        const { from, to, page = 1, limit = 10 } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                error: 'Please provide from and to query parameters (YYYY-MM-DD format)'
            });
        }

        const startDate = new Date(from);
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Please use YYYY-MM-DD format'
            });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Get total count
        const totalCount = await Reclamation.count({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });

        // Get paginated reclamations WITHOUT the user association to avoid errors
        const reclamations = await Reclamation.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                }
            },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        // Get all reclamations in date range for statistics
        const allStats = await Reclamation.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: ['status', 'priority', 'category', 'adminResponseDate', 'createdAt', 'resolvedAt'],
            raw: true
        });

        // Calculate statistics
        const statusStats = {
            pending: allStats.filter(r => r.status === 'pending').length,
            in_progress: allStats.filter(r => r.status === 'in_progress').length,
            resolved: allStats.filter(r => r.status === 'resolved').length,
            closed: allStats.filter(r => r.status === 'closed').length
        };

        const priorityStats = {
            low: allStats.filter(r => r.priority === 'low').length,
            medium: allStats.filter(r => r.priority === 'medium').length,
            high: allStats.filter(r => r.priority === 'high').length,
            urgent: allStats.filter(r => r.priority === 'urgent').length
        };

        const categoryStats = {
            technical: allStats.filter(r => r.category === 'technical').length,
            billing: allStats.filter(r => r.category === 'billing').length,
            service: allStats.filter(r => r.category === 'service').length,
            other: allStats.filter(r => r.category === 'other').length
        };

        const respondedReclamations = allStats.filter(r => r.adminResponseDate !== null);
        const resolvedReclamations = allStats.filter(r => r.resolvedAt !== null);

        const avgResponseTime = respondedReclamations.length > 0
            ? respondedReclamations.reduce((sum, r) => {
            const responseTime = new Date(r.adminResponseDate) - new Date(r.createdAt);
            return sum + responseTime;
        }, 0) / respondedReclamations.length
            : 0;

        const avgResolutionTime = resolvedReclamations.length > 0
            ? resolvedReclamations.reduce((sum, r) => {
            const resolutionTime = new Date(r.resolvedAt) - new Date(r.createdAt);
            return sum + resolutionTime;
        }, 0) / resolvedReclamations.length
            : 0;

        res.status(200).json({
            success: true,
            dateRange: {
                from: startDate.toISOString().split('T')[0],
                to: endDate.toISOString().split('T')[0]
            },
            pagination: {
                currentPage: parseInt(page),
                pageSize: parseInt(limit),
                totalRecords: totalCount,
                totalPages: Math.ceil(totalCount / parseInt(limit))
            },
            summary: {
                total: totalCount,
                pending: statusStats.pending,
                inProgress: statusStats.in_progress,
                resolved: statusStats.resolved,
                closed: statusStats.closed,
                responseRate: totalCount > 0 ? ((respondedReclamations.length / totalCount) * 100).toFixed(2) + '%' : '0%',
                resolutionRate: totalCount > 0 ? ((resolvedReclamations.length / totalCount) * 100).toFixed(2) + '%' : '0%',
                avgResponseTimeHours: (avgResponseTime / (1000 * 60 * 60)).toFixed(2),
                avgResolutionTimeHours: (avgResolutionTime / (1000 * 60 * 60)).toFixed(2)
            },
            distribution: {
                byStatus: statusStats,
                byPriority: priorityStats,
                byCategory: categoryStats
            },
            reclamations: reclamations
        });

    } catch (e) {
        console.error('Error fetching reclamation stats:', e);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reclamation statistics',
            message: e.message
        });
    }
});

module.exports = router;