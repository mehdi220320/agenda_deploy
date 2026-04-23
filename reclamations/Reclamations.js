const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Reclamation = sequelize.define("Reclamation", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    user: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'resolved', 'closed'),
        defaultValue: 'pending'
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium'
    },
    picture: {
        type: DataTypes.STRING,
        allowNull: true
    },
    date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    adminResponse: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    adminResponsePicture: {
        type: DataTypes.STRING,
        allowNull: true
    },
    adminResponseDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    respondedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    category: {
        type: DataTypes.ENUM('technical', 'billing', 'service', 'other'),
        defaultValue: 'other'
    }
}, {
    timestamps: true,
    paranoid: true
});

module.exports = Reclamation;