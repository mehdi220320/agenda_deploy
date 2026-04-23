const express = require('express');
const router = express.Router();
const Availability = require('../agenda/Availability');
const Break = require('../agenda/Break');
const AvailabilityOverride=require("../agenda/AvailabilityOverride");
const ExpertProfile=require('../expertProfile/ExpertProfile')
const {authentication}=require('../middleware/authMiddleware')

const { Op } = require('sequelize');

router.get('/account-progress', authentication, async (req, res) => {
    try {
        const id = req.user.userId;

        const availability = await Availability.findOne({ where: { userId: id } });
        const breakRecord = await Break.findOne({ where: { userId: id } });
        const profile = await ExpertProfile.findOne({ where: { expert: id } });

        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek); // Start from Sunday
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // End on Saturday
        endOfWeek.setHours(23, 59, 59, 999);

        const availabilityOverrides = await AvailabilityOverride.findAll({
            where: {
                userId: id,
                day: {
                    [Op.between]: [startOfWeek, endOfWeek]
                }
            }
        });

        const progressData = calculateProgress({
            profile,
            availability,
            breakRecord,
            availabilityOverrides,
            startOfWeek,
            endOfWeek
        });

        return res.status(200).json({
            success: true,
            data: {
                userId: id,
                progress: progressData,
                details: {
                    profile: !!profile,
                    availability: !!availability,
                    breakRecord: !!breakRecord,
                    availabilityOverridesCount: availabilityOverrides.length
                }
            }
        });

    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

function calculateProgress({ profile, availability, breakRecord, availabilityOverrides, startOfWeek, endOfWeek }) {

    const weights = {
        profile: 0.40,
        availability: 0.30,
        breakTimes: 0.15,
        overrides: 0.15
    };

    let scores = {
        profile: 0,
        availability: 0,
        breakTimes: 0,
        overrides: 0
    };

    let warnings = [];
    const daysOfWeekNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    if (!profile) {
        scores.profile = 0;
        warnings.push({
            id: 'PROFILE_MISSING',
            severity: 'critical',
            message: 'Le profil expert n\'est pas configuré',
            action: 'Veuillez créer votre profil expert pour commencer à accepter des réservations',
            progress: 0
        });
    } else {
        const requiredFields = [
            { name: 'category', label: 'catégorie' },
            { name: 'bio', label: 'biographie' },
            { name: 'headline', label: 'titre' },
            { name: 'languages', label: 'langues' }
        ];

        const completedFields = requiredFields.filter(field => {
            const value = profile[field.name];
            if (field.name === 'languages') {
                return Array.isArray(value) && value.length > 0;
            }
            return value && value !== null && value !== '';
        });

        scores.profile = completedFields.length / requiredFields.length;

        if (scores.profile < 1) {
            const missingFields = requiredFields
                .filter(f => {
                    const value = profile[f.name];
                    if (f.name === 'languages') {
                        return !Array.isArray(value) || value.length === 0;
                    }
                    return !value || value === null || value === '';
                })
                .map(f => f.label);

            warnings.push({
                id: 'PROFILE_INCOMPLETE',
                severity: 'high',
                message: `Le profil expert est complété à ${Math.round(scores.profile * 100)}%`,
                action: `Manquant: ${missingFields.join(', ')}`,
                progress: Math.round(scores.profile * 100),
                missingFields: missingFields
            });
        }
    }

    if (!availability) {
        scores.availability = 0;
        warnings.push({
            id: 'AVAILABILITY_MISSING',
            severity: 'critical',
            message: 'La disponibilité générale n\'est pas configurée',
            action: 'Définissez votre horaire de disponibilité pour activer les réservations clients. Choisissez les jours et heures de travail',
            progress: 0
        });
    } else {
        // Check if availability has days configured
        const daysConfigured = Array.isArray(availability.dayOfWeek) ? availability.dayOfWeek.length : 0;
        const hasStartTime = availability.startTime && availability.startTime !== null;
        const hasEndTime = availability.endTime && availability.endTime !== null;

        const isFullyConfigured = daysConfigured > 0 && hasStartTime && hasEndTime;

        if (isFullyConfigured) {
            scores.availability = 1;
        } else {
            scores.availability = 0.5; // Partial credit
        }

        if (!isFullyConfigured) {
            const missing = [];
            if (daysConfigured === 0) missing.push('jours de travail');
            if (!hasStartTime) missing.push('heure de début');
            if (!hasEndTime) missing.push('heure de fin');

            warnings.push({
                id: 'AVAILABILITY_INCOMPLETE',
                severity: 'critical',
                message: 'La disponibilité est incomplète',
                action: `Configurez: ${missing.join(', ')}. Actuellement défini pour ${daysConfigured} jour(s)`,
                progress: Math.round(scores.availability * 100),
                configuredDays: daysConfigured,
                daysOfWeek: Array.isArray(availability.dayOfWeek)
                    ? availability.dayOfWeek.map(d => daysOfWeekNames[d]).join(', ')
                    : 'Aucun'
            });
        } else {
            warnings.push({
                id: 'AVAILABILITY_CONFIGURED',
                severity: 'info',
                message: `Disponibilité configurée pour ${daysConfigured} jour(s) par semaine`,
                action: null,
                progress: 100,
                daysOfWeek: availability.dayOfWeek.map(d => daysOfWeekNames[d]).join(', '),
                workingHours: `${availability.startTime} - ${availability.endTime}`,
                slotDuration: `${availability.slotDuration} minutes`
            });
        }
    }


    if (!breakRecord) {
        scores.breakTimes = 0.5; // Half credit - not critical but recommended
        warnings.push({
            id: 'BREAK_TIMES_MISSING',
            severity: 'low',
            message: 'Les heures de pause ne sont pas configurées',
            action: 'Recommandé: Définissez vos heures de pause (par exemple, déjeuner 12:00-13:00) pour bloquer les créneaux indisponibles',
            progress: 0
        });
    } else {
        const hasStartTime = breakRecord.startAt && breakRecord.startAt !== null;
        const hasEndTime = breakRecord.endAt && breakRecord.endAt !== null;

        if (hasStartTime && hasEndTime) {
            scores.breakTimes = 1;
            warnings.push({
                id: 'BREAK_TIMES_CONFIGURED',
                severity: 'info',
                message: 'Heures de pause configurées',
                action: null,
                progress: 100,
                breakTime: `${breakRecord.startAt} - ${breakRecord.endAt}`
            });
        } else {
            scores.breakTimes = 0.5;
            warnings.push({
                id: 'BREAK_TIMES_INCOMPLETE',
                severity: 'low',
                message: 'Les heures de pause sont incomplètes',
                action: 'Définissez à la fois l\'heure de début et l\'heure de fin de votre pause quotidienne',
                progress: 0
            });
        }
    }


    const daysInWeek = 7;
    const overrideCount = availabilityOverrides.length;

    if (overrideCount === 0) {
        scores.overrides = 0;
        warnings.push({
            id: 'NO_OVERRIDES_THIS_WEEK',
            severity: 'info',
            message: 'Aucune modification de disponibilité définie pour cette semaine',
            action: 'Optionnel: Ajoutez des modifications pour les jours fériés, congés ou disponibilité spéciale cette semaine',
            progress: 0,
            dateRange: {
                from: startOfWeek.toISOString().split('T')[0],
                to: endOfWeek.toISOString().split('T')[0]
            }
        });
    } else {
        let totalWorkingTimeIntervals = 0;
        const overridesWithValidTimes = availabilityOverrides.filter(o => {
            const count = o.workingTimes && Array.isArray(o.workingTimes) ? o.workingTimes.length : 0;
            totalWorkingTimeIntervals += count;
            return count > 0;
        });

        scores.overrides = Math.min(overridesWithValidTimes.length / daysInWeek, 1);

        if (totalWorkingTimeIntervals === 0) {
            warnings.push({
                id: 'OVERRIDES_EMPTY',
                severity: 'medium',
                message: `${overrideCount} modification(s) n'ont pas d'heures de travail définie(s)`,
                action: 'Supprimez les modifications vides ou ajoutez des intervalles de temps à celle-ci',
                progress: 0,
                emptyOverrideCount: overrideCount
            });
        } else {
            warnings.push({
                id: 'OVERRIDES_CONFIGURED',
                severity: 'info',
                message: `${overrideCount} modification(s) de disponibilité configurée(s) cette semaine`,
                action: null,
                progress: Math.round(scores.overrides * 100),
                overrideCount: overrideCount,
                totalTimeIntervals: totalWorkingTimeIntervals,
                dateRange: {
                    from: startOfWeek.toISOString().split('T')[0],
                    to: endOfWeek.toISOString().split('T')[0]
                }
            });
        }
    }


    const totalProgress = Math.round(
        (scores.profile * weights.profile +
            scores.availability * weights.availability +
            scores.breakTimes * weights.breakTimes +
            scores.overrides * weights.overrides) * 100
    );

    // Determine setup status
    let setupStatus = 'incomplete';
    if (totalProgress >= 100) {
        setupStatus = 'complete';
    } else if (totalProgress >= 70) {
        setupStatus = 'almost-complete';
    } else if (totalProgress >= 40) {
        setupStatus = 'in-progress';
    }

    return {
        totalProgress,
        setupStatus, // 'complete', 'almost-complete', 'in-progress', 'incomplete'
        breakdown: {
            profile: {
                progress: Math.round(scores.profile * 100),
                weight: `${weights.profile * 100}%`,
                completed: !!profile && scores.profile === 1,
                fieldsCovered: profile ? [
                    profile.category ? 'catégorie' : null,
                    profile.bio ? 'biographie' : null,
                    profile.headline ? 'titre' : null,
                    (Array.isArray(profile.languages) && profile.languages.length > 0) ? 'langues' : null
                ].filter(Boolean) : []
            },
            availability: {
                progress: Math.round(scores.availability * 100),
                weight: `${weights.availability * 100}%`,
                completed: !!availability && scores.availability === 1,
                daysConfigured: availability ? (Array.isArray(availability.dayOfWeek) ? availability.dayOfWeek.length : 0) : 0,
                slotDuration: availability ? availability.slotDuration : null
            },
            breakTimes: {
                progress: Math.round(scores.breakTimes * 100),
                weight: `${weights.breakTimes * 100}%`,
                completed: !!breakRecord && scores.breakTimes === 1,
                configured: !!breakRecord
            },
            overrides: {
                progress: Math.round(scores.overrides * 100),
                weight: `${weights.overrides * 100}%`,
                completed: availabilityOverrides.length > 0,
                count: availabilityOverrides.length
            }
        },
        warnings: warnings.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        }),
        criticalBlockers: warnings.filter(w => w.severity === 'critical').length > 0,
        nextSteps: warnings
            .filter(w => w.severity !== 'info' && w.action)
            .slice(0, 3)
            .map(w => ({ id: w.id, action: w.action }))
    };
}

module.exports = router;

