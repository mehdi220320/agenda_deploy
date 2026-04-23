const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User=require('../models/User');

const Conversation = sequelize.define("Conversation", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    client: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        },
    },
    expert: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        },
        validate: {
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
}, {
    hooks: {
        beforeCreate: async (conversation) => {
            const existing = await Conversation.findOne({
                where: {
                    client: conversation.client,
                    expert: conversation.expert
                }
            });

            if (existing) {
                throw new Error(
                    `A conversation between this client and expert already exists (id: ${existing.id})`
                );
            }
        }
    }
});

module.exports = Conversation;