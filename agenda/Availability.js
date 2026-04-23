const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User = require("../models/User");

const Availability = sequelize.define("Availability", {
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
        },
        validate:{
            async isUserExpert(value) {
                const user = await User.findByPk(value);
                if (!user) {
                    throw new Error('User not found');
                }
                if (user.role !== 'expert') {
                    throw new Error('Only users with EXPERT role can be assigned as expert');
                }
                return true;
            }
        }
    },
    dayOfWeek: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [1],
        validate: {
            isValidDayArray(value) {
                if (!Array.isArray(value)) {
                    throw new Error('dayOfWeek must be an array');
                }
                const validDays = [0, 1, 2, 3, 4, 5, 6];
                for (const day of value) {
                    if (!validDays.includes(day)) {
                        throw new Error(`Invalid day value: ${day}. Must be between 0 and 6`);
                    }
                }
            }
        }
    },
    startTime: {type : DataTypes.TIME, allowNull:false},
    endTime: {type : DataTypes.TIME, allowNull:false},
    slotDuration:{type:DataTypes.INTEGER, defaultValue:15,allowNull:false},

});

module.exports = Availability;