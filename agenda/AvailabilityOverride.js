const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AvailabilityOverride = sequelize.define("AvailabilityOverride", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    day: {
        type: DataTypes.DATE,
        allowNull: false
    },
    workingTimes: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        validate: {
            isValidIntervals(value) {
                if (!Array.isArray(value)) {
                    throw new Error('workingTimes must be an array');
                }

                const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

                const toMinutes = (time) => {
                    const [hours, minutes] = time.split(':').map(Number);
                    return hours * 60 + minutes;
                };

                value.forEach((interval, index) => {
                    if (!interval.start || !interval.end) {
                        throw new Error(`Interval at index ${index} must have start and end`);
                    }
                    if (!timeRegex.test(interval.start) || !timeRegex.test(interval.end)) {
                        throw new Error(`Interval at index ${index} must have valid HH:mm format`);
                    }
                    if (interval.start >= interval.end) {
                        throw new Error(`Interval at index ${index}: start must be before end`);
                    }
                });

                for (let i = 0; i < value.length; i++) {
                    for (let j = i + 1; j < value.length; j++) {
                        const startA = toMinutes(value[i].start);
                        const endA = toMinutes(value[i].end);
                        const startB = toMinutes(value[j].start);
                        const endB = toMinutes(value[j].end);

                        // Two intervals overlap if one starts before the other ends
                        if (startA < endB && startB < endA) {
                            throw new Error(
                                `Interval ${value[i].start}-${value[i].end} overlaps with ${value[j].start}-${value[j].end}`
                            );
                        }
                    }
                }
            }
        }
    }
});

module.exports = AvailabilityOverride;