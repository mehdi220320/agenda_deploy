const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Break = sequelize.define("Break", {
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
    startAt: {type : DataTypes.TIME, allowNull:false},
    endAt: {type : DataTypes.TIME, allowNull:false},
});

module.exports = Break;